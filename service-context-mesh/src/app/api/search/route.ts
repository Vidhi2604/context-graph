export const dynamic = "force-dynamic";
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
import { isPhoneNumber, journeyToGraph } from "@/lib/nurix-graph-mapper";
import { buildJourneyFromPhone } from "@/lib/enrichment";
import { getConnectors } from "@/lib/connectors/registry";

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

    // ── Phone number search → Nurix journey lookup ──────────────
    if (isPhoneNumber(parsed.data.query)) {
      const connectors = await getConnectors(session.tenantId);
      const nurixConn = connectors.filter(c => c.type === "nurix" && c.active).pop(); // last = most recent
      if (nurixConn) {
        try {
          const nurixConfig = {
            baseUrl: nurixConn.credentials.api_url || "https://agentx-in.nurixlabs.tech",
            workspaceId: nurixConn.credentials.workspace_id || nurixConn.credentials.api_key || "",
          };
          const journey = await buildJourneyFromPhone(parsed.data.query, nurixConfig);
          const graph = journeyToGraph(journey);
          return NextResponse.json({
            query: parsed.data.query,
            cypher: "nurix:phone_lookup",
            cypher_confidence: 1.0,
            interpretation: `Phone journey for ${journey.customer_name || parsed.data.query} — ${journey.events.length} calls, ${journey.insights.overall_sentiment} sentiment`,
            results: graph,
          });
        } catch (err) {
          // Fall through to normal search if phone lookup fails
          console.error("[search] Nurix phone lookup failed:", err instanceof Error ? err.message : err);
        }
      }
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
    completeActivity(
      session.tenantId, llmActId,
      cypherResult.isValid ? "success" : "error",
      cypherResult.isValid ? `confidence: ${cypherResult.cypher_confidence}` : cypherResult.error,
      cypherResult.isValid ? {
        cypher: cypherResult.cypher,
        confidence: cypherResult.cypher_confidence,
        interpretation: cypherResult.interpretation,
        model: "claude-haiku-4-5",
      } : {
        error: cypherResult.error,
        fallback: true,
      }
    );

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
    const neo4jActId = logActivity(session.tenantId, { layer: "neo4j", label: "Neo4j Query", detail: `cypher: ${(cypherResult.cypher || "").slice(0, 80)}…`, status: "running", started_at: Date.now(), metadata: { cypher: cypherResult.cypher } });
    let primaryRecords;
    try {
      primaryRecords = await (trace
        ? trace.run("Neo4j Execution", "runQuery()", "neo4j",
            `cypher length: ${cypherResult.cypher.length} chars`,
            () => runQuery(cypherResult.cypher))
        : runQuery(cypherResult.cypher));
      completeActivity(session.tenantId, neo4jActId, "success", `${primaryRecords.length} records returned`, { records_returned: primaryRecords.length });
    } catch (e) {
      completeActivity(session.tenantId, neo4jActId, "error", "Invalid Cypher — falling back to basic search", { error: e instanceof Error ? e.message : "unknown error", cypher: cypherResult.cypher });
      return handleBasicSearch(parsed.data.query, session.tenantId, vertical, trace, Math.floor(Math.min(parsed.data.limit, plan.maxGraphNodes === Infinity ? 200 : plan.maxGraphNodes)));
    }

    // Extract profile IDs from results, apply filters, expand to full context
    let profileIds = extractProfileIds(primaryRecords);

    // Apply structured filters to narrow profile IDs
    const filtersApplied = Object.values(activeFilters).some(v => v.length > 0);
    if (filtersApplied && profileIds.length > 0) {
      profileIds = await applyFilters(profileIds, activeFilters, session.tenantId, session.vertical);
    }

    // If filters were applied and returned 0 profiles — respect that (don't fall back to unfiltered)
    const contextRecords = profileIds.length > 0
      ? await (trace
          ? trace.run("Context Expansion", "expandContext()", "neo4j",
              `expanding ${profileIds.length} profiles${filtersApplied ? " (filtered)" : ""}`,
              () => expandProfileContext(profileIds, session.tenantId, session.vertical))
          : expandProfileContext(profileIds, session.tenantId, session.vertical))
      : filtersApplied
        ? [] // filters returned 0 results — show empty graph
        : primaryRecords;

    const records = contextRecords.length > 0 ? contextRecords : filtersApplied ? [] : primaryRecords;

    // Map to graph
    const graph = await (trace
      ? trace.run("Graph Mapping", "mapNeo4jToGraph()", "mapping",
          `${records.length} records`,
          async () => mapNeo4jToGraph(records, vertical))
      : Promise.resolve(mapNeo4jToGraph(records, vertical)));

    logActivity(session.tenantId, {
      layer: "mapping", label: "Graph Mapping",
      detail: `${graph.nodes.length} nodes · ${graph.edges.length} edges`,
      status: "success", started_at: Date.now(), ended_at: Date.now(), duration_ms: 0,
      metadata: {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        profiles: graph.nodes.filter(n => n.label === "Profile").length,
        node_types: Array.from(new Set(graph.nodes.map(n => n.label))),
      },
    });

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
  const isRetail = vertical !== "healthcare";
  const eventLabel = isRetail ? "Event" : "Visit";
  const eventRel = isRetail ? "PERFORMED" : "HAD_VISIT";

  // Get cypherFields from vertical schema
  const verticalConfig = (() => { try { return getVertical(vertical); } catch { return null; } })();
  const schemaCypherFields: Record<string, string> = {};
  if (verticalConfig) {
    for (const f of verticalConfig.filters) {
      if (f.cypherField) schemaCypherFields[f.id] = f.cypherField;
    }
  }

  // Classify filters: profile-level vs event-level vs related-node-level
  const profileFields = new Set(["p.tier", "p.city", "p.name", "p.segment"]);

  const profileConditions: string[] = [];
  const eventConditions: string[] = [];
  const relatedJoins: string[] = [];
  const relatedConditions: string[] = [];
  let needsEventJoin = false;
  let dateFrom: string | null = null;
  let dateTo: string | null = null;

  for (const [filterId, values] of Object.entries(filters)) {
    if (!values || values.length === 0) continue;

    // Date range — handled separately
    if (filterId === "dateRange") {
      if (values[0]) dateFrom = values[0];
      if (values[1]) dateTo = values[1];
      needsEventJoin = true;
      continue;
    }

    const field = schemaCypherFields[filterId];
    if (!field) continue;

    const paramKey = `filter_${filterId}`;
    // Case-insensitive: toLower for string comparisons
    const condition = `(toLower(toString(${field})) IN $${paramKey})`;
    params[paramKey] = values.map((v: string) => v.toLowerCase());

    if (profileFields.has(field)) {
      profileConditions.push(condition);
    } else if (field.startsWith("p.")) {
      profileConditions.push(condition);
    } else if (field.startsWith("prod.")) {
      if (!relatedJoins.includes("prod")) {
        relatedJoins.push("prod");
      }
      relatedConditions.push(condition);
      needsEventJoin = true;
    } else if (field.startsWith("pay.")) {
      if (!relatedJoins.includes("pay")) {
        relatedJoins.push("pay");
      }
      relatedConditions.push(condition);
      needsEventJoin = true;
    } else if (field.startsWith("ic.")) {
      if (!relatedJoins.includes("ic")) {
        relatedJoins.push("ic");
      }
      relatedConditions.push(condition);
      needsEventJoin = true;
    } else if (field.startsWith("d.")) {
      if (!relatedJoins.includes("d")) {
        relatedJoins.push("d");
      }
      relatedConditions.push(condition);
      needsEventJoin = true;
    } else {
      // Event/Visit level filter — normalize alias to match query
      const normalizedField = isRetail ? field.replace(/^v\./, "e.") : field.replace(/^e\./, "v.");
      eventConditions.push(`(toLower(toString(${normalizedField})) IN $${paramKey})`);
      needsEventJoin = true;
    }
  }

  let cypher = `MATCH (p:Profile {_tenant: $tenantId})
    WHERE p.profile_id IN $profileIds`;

  if (profileConditions.length > 0) {
    cypher += ` AND ${profileConditions.join(" AND ")}`;
  }

  if (needsEventJoin) {
    const eventAlias = isRetail ? "e" : "v";
    cypher += `
    WITH p
    MATCH (p)-[:${eventRel}]->(${eventAlias}:${eventLabel} {_tenant: $tenantId})`;

    if (relatedJoins.includes("prod")) {
      cypher += `\n    OPTIONAL MATCH (e)-[:INVOLVES]->(prod:Product {_tenant: $tenantId})`;
    }
    if (relatedJoins.includes("pay")) {
      cypher += `\n    OPTIONAL MATCH (${eventAlias})-[:PAID_VIA]->(pay:Payment {_tenant: $tenantId})`;
    }
    if (relatedJoins.includes("ic")) {
      cypher += `\n    OPTIONAL MATCH (${eventAlias})-[:CLAIMED_VIA]->(ic:InsuranceClaim {_tenant: $tenantId})`;
    }
    if (relatedJoins.includes("d")) {
      cypher += `\n    OPTIONAL MATCH (${eventAlias})-[:DIAGNOSED_WITH]->(d:Diagnosis {_tenant: $tenantId})`;
    }

    const allEventConditions = [...eventConditions, ...relatedConditions];
    if (dateFrom) {
      params.dateFrom = dateFrom;
      allEventConditions.push(`(${isRetail ? "e" : "v"}.timestamp >= datetime($dateFrom))`);
    }
    if (dateTo) {
      params.dateTo = dateTo;
      allEventConditions.push(`(${isRetail ? "e" : "v"}.timestamp <= datetime($dateTo))`);
    }

    if (allEventConditions.length > 0) {
      cypher += `\n    WHERE ${allEventConditions.join(" AND ")}`;
    }
  }

  cypher += `
    RETURN DISTINCT p.profile_id AS profile_id
    LIMIT 100`;

  try {
    const results = await runQuery<{ profile_id: string }>(cypher, params);
    return results.map(r => r.profile_id).filter(Boolean);
  } catch (e) {
    console.error("[applyFilters] error:", e instanceof Error ? e.message : e);
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
  const isRetail = vertical !== "healthcare";
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

async function runBasicSearch(query: string, tenantId: string, limit = 25) {
  // Try name match first
  const nameRecords = await runQuery(
    `
    MATCH (p:Profile {_tenant: $tenantId})
    WHERE toLower(p.name) CONTAINS toLower($query)
       OR p.profile_id CONTAINS $query
       OR EXISTS {
         MATCH (p)-[:HAS_IDENTITY]->(i:Identity {_tenant: $tenantId})
         WHERE toLower(i.value) CONTAINS toLower($query)
       }
    WITH DISTINCT p LIMIT $limit
    OPTIONAL MATCH path = (p)-[r]-(connected)
    WHERE connected._tenant = $tenantId
    RETURN p, r, connected, path
    `,
    { query, tenantId, limit: Math.floor(limit) }
  );

  if (nameRecords.length > 0) return nameRecords;

  // Fallback: return a sample of profiles with their context
  return runQuery(
    `
    MATCH (p:Profile {_tenant: $tenantId})
    WITH p LIMIT $limit
    OPTIONAL MATCH path = (p)-[r]-(connected)
    WHERE connected._tenant = $tenantId
    RETURN p, r, connected, path
    `,
    { tenantId, limit: Math.floor(limit) }
  );
}
