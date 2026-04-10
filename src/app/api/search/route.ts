import { NextRequest, NextResponse } from "next/server";
import { SearchSchema } from "@/types/event";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { generateCypher } from "@/lib/cypher-generator";
import { runQuery } from "@/lib/neo4j";
import { mapNeo4jToGraph } from "@/lib/graph-mapper";
import { getVertical } from "@/verticals/registry";
import { PLANS } from "@/lib/plans";
import { TraceCollector } from "@/lib/trace";
import { getDemoResponse } from "@/lib/demo-cache";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const traceEnabled = req.nextUrl.searchParams.get("trace") === "true";
    const trace = traceEnabled ? new TraceCollector() : null;

    const session = await (trace
      ? trace.run("Auth & Tenant Resolution", "getOrgFromRequest()", "auth",
          "session cookie / API key",
          () => getOrgFromRequest(req))
      : getOrgFromRequest(req));

    const { success } = await checkRateLimit(`search:${session.tenantId}`, 30, 60);
    if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const body = await req.json();
    const activeFilters = (body.filters || {}) as Record<string, string[]>;
    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const plan = PLANS[session.plan];
    const vertical = await (trace
      ? trace.run("Vertical Schema Load", "getVertical()", "validation",
          `vertical: ${session.vertical}`,
          async () => getVertical(session.vertical))
      : Promise.resolve(getVertical(session.vertical)));

    // Plan gating
    if (plan.searchType === "basic") {
      trace?.skip("LLM Cypher Generation", "generateCypher()", "llm", "Starter plan — basic search only");
      const result = await handleBasicSearch(parsed.data.query, session.tenantId, vertical, trace, Math.min(parsed.data.limit, plan.maxGraphNodes));
      if (trace) {
        const traceData = trace.finalize("search", parsed.data.query);
        const json = await result.json();
        return NextResponse.json({ ...json, _trace: traceData });
      }
      return result;
    }

    // Demo cache check — bypass LLM+Neo4j for instant demo responses
    const cached = getDemoResponse(parsed.data.query, session.tenantId);
    if (cached) {
      trace?.skip("LLM Cypher Generation", "getDemoResponse()", "llm", "Demo cache hit");
      return NextResponse.json({
        query: parsed.data.query,
        cypher: "demo_cache",
        cypher_confidence: 1.0,
        interpretation: `Demo response for "${parsed.data.query}"`,
        results: cached,
        _demo: true,
        ...(trace ? { _trace: trace.finalize("search", parsed.data.query) } : {}),
      });
    }

    // LLM → Cypher
    const cypherResult = await (trace
      ? trace.run("LLM Cypher Generation", "generateCypher()", "llm",
          `query: "${parsed.data.query}", model: llama-3.3-70b`,
          () => generateCypher(parsed.data.query, session.tenantId, session.vertical,
                               Math.min(parsed.data.limit, plan.maxGraphNodes)))
      : generateCypher(parsed.data.query, session.tenantId, session.vertical,
                       Math.min(parsed.data.limit, plan.maxGraphNodes)));

    if (!cypherResult.isValid) {
      trace?.skip("Cypher Validation", "validateCypher()", "validation", `Failed: ${cypherResult.error}. Falling back.`);
      return handleBasicSearch(parsed.data.query, session.tenantId, vertical, trace, Math.min(parsed.data.limit, plan.maxGraphNodes));
    }

    await (trace
      ? trace.run("Cypher Validation", "validateCypher()", "validation",
          `confidence: ${cypherResult.cypher_confidence}`,
          async () => ({ valid: true, confidence: cypherResult.cypher_confidence }))
      : Promise.resolve());

    // Execute primary query
    const primaryRecords = await (trace
      ? trace.run("Neo4j Execution", "runQuery()", "neo4j",
          `cypher length: ${cypherResult.cypher.length} chars`,
          () => runQuery(cypherResult.cypher))
      : runQuery(cypherResult.cypher));

    // Extract profile IDs from results, apply filters, expand to full context
    let profileIds = extractProfileIds(primaryRecords);

    // Apply structured filters to narrow profile IDs
    if (Object.keys(activeFilters).length > 0 && profileIds.length > 0) {
      profileIds = await applyFilters(profileIds, activeFilters, session.tenantId);
    }

    const contextRecords = profileIds.length > 0
      ? await (trace
          ? trace.run("Context Expansion", "expandContext()", "neo4j",
              `expanding ${profileIds.length} profiles${Object.keys(activeFilters).length > 0 ? " (filtered)" : ""}`,
              () => expandProfileContext(profileIds, session.tenantId, session.vertical))
          : expandProfileContext(profileIds, session.tenantId, session.vertical))
      : primaryRecords;

    const records = contextRecords.length > 0 ? contextRecords : primaryRecords;

    // Map to graph
    const graph = await (trace
      ? trace.run("Graph Mapping", "mapNeo4jToGraph()", "mapping",
          `${records.length} records`,
          async () => mapNeo4jToGraph(records, vertical))
      : Promise.resolve(mapNeo4jToGraph(records, vertical)));

    // Relevance scoring (already computed inside mapNeo4jToGraph via Cypher)
    trace?.skip("Relevance Scoring", "computeRelevance()", "scoring",
      `Computed inline — avg: ${(graph.nodes.reduce((s, n) => s + (n.relevance ?? 0.7), 0) / Math.max(graph.nodes.length, 1)).toFixed(2)}`);

    const response = {
      query: parsed.data.query,
      cypher: cypherResult.cypher,
      cypher_confidence: cypherResult.cypher_confidence,
      interpretation: cypherResult.interpretation,
      results: graph,
      ...(trace ? { _trace: trace.finalize("search", parsed.data.query) } : {}),
    };

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}

async function handleBasicSearch(
  query: string,
  tenantId: string,
  vertical: ReturnType<typeof getVertical>,
  trace: TraceCollector | null,
  limit = 25
) {
  const records = await (trace
    ? trace.run("Neo4j Basic Search", "runQuery()", "neo4j",
        `text search: "${query}"`,
        () => runBasicSearch(query, tenantId, limit))
    : runBasicSearch(query, tenantId, limit));

  const graph = mapNeo4jToGraph(records, vertical);

  return NextResponse.json({
    query,
    cypher: "basic text search",
    cypher_confidence: 1.0,
    interpretation: `Text search for "${query}"`,
    results: graph,
  });
}

// Apply structured filters to narrow profile IDs
async function applyFilters(
  profileIds: string[],
  filters: Record<string, string[]>,
  tenantId: string
): Promise<string[]> {
  // Build WHERE conditions from filters
  const conditions: string[] = ["p.profile_id IN $profileIds", "p._tenant = $tenantId"];
  const params: Record<string, unknown> = { profileIds, tenantId };

  const FILTER_FIELD_MAP: Record<string, string> = {
    tier: "p.tier",
    city: "p.city",
    category: "prod.category",
    payment: "pay.method",
    status: "e.status",
    department: "v.department",
    priority: "v.priority",
    severity: "d.severity",
    claimStatus: "ic.status",
    visitType: "v.type",
  };

  const profileOnlyFilters = ["tier", "city"];
  const needsEventJoin = Object.keys(filters).some(k => !profileOnlyFilters.includes(k) && filters[k].length > 0);

  let cypher = `MATCH (p:Profile {_tenant: $tenantId}) WHERE p.profile_id IN $profileIds`;

  if (needsEventJoin) {
    cypher += `
    OPTIONAL MATCH (p)-[:PERFORMED|HAD_VISIT]->(e)
    OPTIONAL MATCH (e)-[:INVOLVES]->(prod:Product)
    OPTIONAL MATCH (e)-[:PAID_VIA]->(pay:Payment)
    OPTIONAL MATCH (e)-[:CLAIMED_VIA]->(ic:InsuranceClaim)
    OPTIONAL MATCH (e)-[:DIAGNOSED_WITH]->(d:Diagnosis)
    WITH p, e, prod, pay, ic, d`;
  }

  for (const [filterId, values] of Object.entries(filters)) {
    if (!values || values.length === 0) continue;
    const field = FILTER_FIELD_MAP[filterId];
    if (!field) continue;
    const paramKey = `filter_${filterId}`;
    conditions.push(`(${field} IN $${paramKey})`);
    params[paramKey] = values;
  }

  cypher += `
    WHERE ${conditions.join(" AND ")}
    RETURN DISTINCT p.profile_id AS profile_id
    LIMIT 20`;

  try {
    const results = await runQuery<{ profile_id: string }>(cypher, params);
    return results.map(r => r.profile_id).filter(Boolean);
  } catch {
    // If filter query fails, return original IDs
    return profileIds;
  }
}

// Extract profile IDs from any Neo4j result set
function extractProfileIds(records: Record<string, unknown>[]): string[] {
  const ids = new Set<string>();
  for (const record of records) {
    for (const value of Object.values(record)) {
      const node = value as Record<string, unknown>;
      if (node && typeof node === "object" && "labels" in node) {
        const labels = node.labels as string[];
        const props = node.properties as Record<string, unknown>;
        if (labels?.includes("Profile") && props?.profile_id) {
          ids.add(String(props.profile_id));
        }
      }
    }
  }
  return Array.from(ids).slice(0, 20); // max 20 profiles for graph clarity
}

// Expand profiles to their full context graph
function expandProfileContext(profileIds: string[], tenantId: string, vertical: string) {
  const isRetail = vertical === "retail";
  const relType = isRetail ? "PERFORMED" : "HAD_VISIT";
  const eventLabel = isRetail ? "Event" : "Visit";

  return runQuery(
    `
    UNWIND $profileIds AS pid
    MATCH (p:Profile {profile_id: pid, _tenant: $tenantId})
    OPTIONAL MATCH (p)-[r1:${relType}]->(e:${eventLabel} {_tenant: $tenantId})
    OPTIONAL MATCH (e)-[r2:INVOLVES]->(prod:Product {_tenant: $tenantId})
    OPTIONAL MATCH (e)-[r3:PAID_VIA]->(pay:Payment {_tenant: $tenantId})
    OPTIONAL MATCH (e)-[r4:GOVERNED_BY|OVERRODE]->(pol:Policy {_tenant: $tenantId})
    OPTIONAL MATCH (e)-[r5:HANDLED_BY]->(a:Agent {_tenant: $tenantId})
    OPTIONAL MATCH (e)-[r6:DIAGNOSED_WITH]->(d:Diagnosis {_tenant: $tenantId})
    OPTIONAL MATCH (e)-[r7:ATTENDED_BY]->(pr:Provider {_tenant: $tenantId})
    OPTIONAL MATCH (p)-[r8:HAS_COMMITMENT]->(c:Commitment {_tenant: $tenantId})
    RETURN p, r1, e, r2, prod, r3, pay, r4, pol, r5, a, r6, d, r7, pr, r8, c
    ORDER BY e.timestamp DESC
    LIMIT 100
    `,
    { profileIds, tenantId }
  );
}

function runBasicSearch(query: string, tenantId: string, limit = 25) {
  return runQuery(
    `
    MATCH (p:Profile {_tenant: $tenantId})
    WHERE p.name CONTAINS $query OR p.profile_id CONTAINS $query
    WITH p
    UNION
    MATCH (i:Identity {_tenant: $tenantId})<-[:HAS_IDENTITY]-(p:Profile {_tenant: $tenantId})
    WHERE i.value CONTAINS $query
    WITH p
    WITH DISTINCT p LIMIT $limit
    OPTIONAL MATCH (p)-[r]-(connected)
    WHERE connected._tenant = $tenantId
    RETURN p, r, connected
    `,
    { query, tenantId, limit }
  );
}
