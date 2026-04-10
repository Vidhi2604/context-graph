import { NextRequest, NextResponse } from "next/server";
import { SearchSchema } from "@/types/event";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { generateCypher } from "@/lib/cypher-generator";
import { runQuery } from "@/lib/neo4j";
import { mapNeo4jToGraph } from "@/lib/graph-mapper";
import { getVertical } from "@/verticals/registry";
import { PLANS } from "@/lib/plans";
import { TraceCollector } from "@/lib/trace";

import { checkRateLimit } from "@/lib/rate-limit";
import { getStreamInfo, isStreamsConfigured } from "@/lib/streams";
import { logActivity, completeActivity } from "@/lib/activity-log";

export async function POST(req: NextRequest) {
  try {
    const traceEnabled = req.nextUrl.searchParams.get("trace") === "true";
    const trace = traceEnabled ? new TraceCollector() : null;

    const t0 = Date.now();
    const session = await (trace
      ? trace.run("Auth & Tenant Resolution", "getOrgFromRequest()", "auth",
          "session cookie / API key",
          () => getOrgFromRequest(req))
      : getOrgFromRequest(req));
    logActivity(session.tenantId, { layer: "auth", label: "Auth & Tenant Resolution", detail: `org: ${session.orgId}`, status: "success", started_at: t0, ended_at: Date.now(), duration_ms: Date.now() - t0 });

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
    const t1 = Date.now();
    const vertical = await (trace
      ? trace.run("Vertical Schema Load", "getVertical()", "validation",
          `vertical: ${session.vertical}`,
          async () => getVertical(session.vertical))
      : Promise.resolve(getVertical(session.vertical)));
    logActivity(session.tenantId, { layer: "auth", label: "Vertical Schema Load", detail: `vertical: ${session.vertical} · plan: ${session.plan}`, status: "success", started_at: t1, ended_at: Date.now(), duration_ms: Date.now() - t1 });

    // Plan gating
    if (plan.searchType === "basic") {
      trace?.skip("LLM Cypher Generation", "generateCypher()", "llm", "Starter plan — basic search only");
      const result = await handleBasicSearch(parsed.data.query, session.tenantId, vertical, trace, Math.floor(Math.min(parsed.data.limit, plan.maxGraphNodes === Infinity ? 200 : plan.maxGraphNodes)));
      if (trace) {
        const traceData = trace.finalize("search", parsed.data.query);
        const json = await result.json();
        return NextResponse.json({ ...json, _trace: traceData });
      }
      return result;
    }



    // LLM → Cypher
    const llmActId = logActivity(session.tenantId, { layer: "llm", label: "LLM Cypher Generation", detail: `query: "${parsed.data.query}"`, status: "running", started_at: Date.now() });
    const cypherResult = await (trace
      ? trace.run("LLM Cypher Generation", "generateCypher()", "llm",
          `query: "${parsed.data.query}", model: claude-haiku-4-5`,
          () => generateCypher(parsed.data.query, session.tenantId, session.vertical,
                               Math.floor(Math.min(parsed.data.limit, plan.maxGraphNodes === Infinity ? 200 : plan.maxGraphNodes))))
      : generateCypher(parsed.data.query, session.tenantId, session.vertical,
                       Math.floor(Math.min(parsed.data.limit, plan.maxGraphNodes === Infinity ? 200 : plan.maxGraphNodes))));
    completeActivity(session.tenantId, llmActId, cypherResult.isValid ? "success" : "error", cypherResult.isValid ? `cypher generated, confidence: ${cypherResult.cypher_confidence}` : cypherResult.error);

    if (!cypherResult.isValid) {
      trace?.skip("Cypher Validation", "validateCypher()", "validation", `Failed: ${cypherResult.error}. Falling back.`);
      return handleBasicSearch(parsed.data.query, session.tenantId, vertical, trace, Math.floor(Math.min(parsed.data.limit, plan.maxGraphNodes === Infinity ? 200 : plan.maxGraphNodes)));
    }

    await (trace
      ? trace.run("Cypher Validation", "validateCypher()", "validation",
          `confidence: ${cypherResult.cypher_confidence}`,
          async () => ({ valid: true, confidence: cypherResult.cypher_confidence }))
      : Promise.resolve());

    // Execute primary query
    const neo4jActId = logActivity(session.tenantId, { layer: "neo4j", label: "Neo4j Query", detail: `cypher: ${cypherResult.cypher.slice(0, 80)}…`, status: "running", started_at: Date.now() });
    const primaryRecords = await (trace
      ? trace.run("Neo4j Execution", "runQuery()", "neo4j",
          `cypher length: ${cypherResult.cypher.length} chars`,
          () => runQuery(cypherResult.cypher))
      : runQuery(cypherResult.cypher));
    completeActivity(session.tenantId, neo4jActId, "success", `${primaryRecords.length} records`);

    // Extract profile IDs from results, apply filters, expand to full context
    let profileIds = extractProfileIds(primaryRecords);

    // Apply structured filters to narrow profile IDs
    if (Object.keys(activeFilters).length > 0 && profileIds.length > 0) {
      profileIds = await applyFilters(profileIds, activeFilters, session.tenantId, session.vertical);
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

    // Show Redis Streams state in trace
    if (trace) await addRedisTrace(trace, session.tenantId);

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
  tenantId: string,
  vertical = "retail"
): Promise<string[]> {
  const params: Record<string, unknown> = { profileIds, tenantId };

  // Use cypherField from vertical schema if available, else fallback map
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

  // Try to get cypherField from vertical schema
  const verticalConfig = (() => { try { return getVertical(vertical); } catch { return null; } })();
  const schemaCypherFields: Record<string, string> = {};
  if (verticalConfig) {
    for (const f of verticalConfig.filters) {
      if (f.cypherField) schemaCypherFields[f.id] = f.cypherField;
    }
  }

  const profileOnlyFilters = ["tier", "city"];
  const needsEventJoin = Object.keys(filters).some(k => !profileOnlyFilters.includes(k) && filters[k].length > 0);

  const filterConditions: string[] = [];
  for (const [filterId, values] of Object.entries(filters)) {
    if (!values || values.length === 0) continue;
    if (filterId === "dateRange") continue;
    let field = schemaCypherFields[filterId] || FILTER_FIELD_MAP[filterId];
    if (!field) continue;
    // The event join uses alias `e` — remap v./visit alias to e.
    field = field.replace(/^v\./, "e.");
    const paramKey = `filter_${filterId}`;
    filterConditions.push(`(${field} IN $${paramKey})`);
    params[paramKey] = values;
  }

  let cypher = `MATCH (p:Profile {_tenant: $tenantId})
    WHERE p.profile_id IN $profileIds`;

  // Profile-level filters can go directly in WHERE
  const profileConditions = filterConditions.filter(c =>
    c.includes("p.tier") || c.includes("p.city")
  );
  const eventConditions = filterConditions.filter(c =>
    !c.includes("p.tier") && !c.includes("p.city")
  );

  if (profileConditions.length > 0) {
    cypher += ` AND ${profileConditions.join(" AND ")}`;
  }

  if (needsEventJoin && eventConditions.length > 0) {
    cypher += `
    WITH p
    MATCH (p)-[:PERFORMED|HAD_VISIT]->(e)
    OPTIONAL MATCH (e)-[:INVOLVES]->(prod:Product)
    OPTIONAL MATCH (e)-[:PAID_VIA]->(pay:Payment)
    OPTIONAL MATCH (e)-[:CLAIMED_VIA]->(ic:InsuranceClaim)
    OPTIONAL MATCH (e)-[:DIAGNOSED_WITH]->(d:Diagnosis)
    WHERE ${eventConditions.join(" AND ")}`;
  }

  cypher += `
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

  // Return as paths so graph-mapper can extract nodes + edges with correct IDs
  return runQuery(
    `
    UNWIND $profileIds AS pid
    MATCH (p:Profile {profile_id: pid, _tenant: $tenantId})

    // Profile → Event/Visit paths
    OPTIONAL MATCH path1 = (p)-[:${relType}]->(e:${eventLabel} {_tenant: $tenantId})

    // Event → Product paths
    OPTIONAL MATCH path2 = (e)-[:INVOLVES]->(prod:Product {_tenant: $tenantId})

    // Event → Payment paths
    OPTIONAL MATCH path3 = (e)-[:PAID_VIA]->(pay:Payment {_tenant: $tenantId})

    // Event → Policy paths (GOVERNED_BY or OVERRODE)
    OPTIONAL MATCH path4 = (e)-[:GOVERNED_BY|OVERRODE]->(pol:Policy {_tenant: $tenantId})

    // Event → Agent/Provider paths
    OPTIONAL MATCH path5 = (e)-[:HANDLED_BY|ATTENDED_BY]->(handler {_tenant: $tenantId})

    // Profile → Commitment paths
    OPTIONAL MATCH path6 = (p)-[:HAS_COMMITMENT]->(c:Commitment {_tenant: $tenantId})

    // Healthcare: Event → Diagnosis paths
    OPTIONAL MATCH path7 = (e)-[:DIAGNOSED_WITH]->(d:Diagnosis {_tenant: $tenantId})

    RETURN p, path1, path2, path3, path4, path5, path6, path7
    LIMIT 150
    `,
    { profileIds, tenantId }
  );
}


async function addRedisTrace(trace: TraceCollector, tenantId: string) {
  if (!isStreamsConfigured()) {
    trace.skip("Redis Stream", "getStreamInfo()", "streams", "Upstash not configured");
    return;
  }
  await trace.run("Redis Stream", "getStreamInfo()", "streams", `tenant: ${tenantId}`, async () => {
    const info = await getStreamInfo(tenantId);
    return `stream:${tenantId} · ${info.length} msgs · last_id: ${info.last_id}`;
  });
}

function runBasicSearch(query: string, tenantId: string, limit = 25) {
  return runQuery(
    `
    MATCH (p:Profile {_tenant: $tenantId})
    WHERE p.name CONTAINS $query
       OR p.profile_id CONTAINS $query
       OR EXISTS {
         MATCH (p)-[:HAS_IDENTITY]->(i:Identity {_tenant: $tenantId})
         WHERE i.value CONTAINS $query
       }
    WITH DISTINCT p LIMIT $limit
    OPTIONAL MATCH path = (p)-[r]-(connected)
    WHERE connected._tenant = $tenantId
    RETURN p, r, connected, path
    `,
    { query, tenantId, limit: Math.floor(limit) }
  );
}
