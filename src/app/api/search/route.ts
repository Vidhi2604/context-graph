import { NextRequest, NextResponse } from "next/server";
import { SearchSchema } from "@/types/event";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { generateCypher } from "@/lib/cypher-generator";
import { runQuery } from "@/lib/neo4j";
import { mapNeo4jToGraph } from "@/lib/graph-mapper";
import { getVertical } from "@/verticals/registry";
import { PLANS } from "@/lib/plans";
import { TraceCollector } from "@/lib/trace";

export async function POST(req: NextRequest) {
  try {
    const traceEnabled = req.nextUrl.searchParams.get("trace") === "true";
    const trace = traceEnabled ? new TraceCollector() : null;

    const session = await (trace
      ? trace.run("Auth & Tenant Resolution", "getOrgFromRequest()", "auth",
          "session cookie / API key",
          () => getOrgFromRequest(req))
      : getOrgFromRequest(req));

    const body = await req.json();
    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search", details: parsed.error.flatten() },
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
      const result = await handleBasicSearch(parsed.data.query, session.tenantId, vertical, trace);
      if (trace) {
        const traceData = trace.finalize("search", parsed.data.query);
        const json = await result.json();
        return NextResponse.json({ ...json, _trace: traceData });
      }
      return result;
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
      return handleBasicSearch(parsed.data.query, session.tenantId, vertical, trace);
    }

    await (trace
      ? trace.run("Cypher Validation", "validateCypher()", "validation",
          `confidence: ${cypherResult.cypher_confidence}`,
          async () => ({ valid: true, confidence: cypherResult.cypher_confidence }))
      : Promise.resolve());

    // Execute
    const records = await (trace
      ? trace.run("Neo4j Execution", "runQuery()", "neo4j",
          `cypher length: ${cypherResult.cypher.length} chars`,
          () => runQuery(cypherResult.cypher))
      : runQuery(cypherResult.cypher));

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
  trace: TraceCollector | null
) {
  const records = await (trace
    ? trace.run("Neo4j Basic Search", "runQuery()", "neo4j",
        `text search: "${query}"`,
        () => runBasicSearch(query, tenantId))
    : runBasicSearch(query, tenantId));

  const graph = mapNeo4jToGraph(records, vertical);

  return NextResponse.json({
    query,
    cypher: "basic text search",
    cypher_confidence: 1.0,
    interpretation: `Text search for "${query}"`,
    results: graph,
  });
}

function runBasicSearch(query: string, tenantId: string) {
  return runQuery(
    `
    MATCH (p:Profile {_tenant: $tenantId})
    WHERE p.name CONTAINS $query OR p.profile_id CONTAINS $query
    WITH p
    UNION
    MATCH (i:Identity {_tenant: $tenantId})<-[:HAS_IDENTITY]-(p:Profile {_tenant: $tenantId})
    WHERE i.value CONTAINS $query
    WITH p
    WITH DISTINCT p LIMIT 25
    OPTIONAL MATCH (p)-[r]-(connected)
    WHERE connected._tenant = $tenantId OR connected._tenant IS NULL
    RETURN p, r, connected
    `,
    { query, tenantId }
  );
}
