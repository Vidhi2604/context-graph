import { NextRequest, NextResponse } from "next/server";
import { SearchSchema } from "@/types/event";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { generateCypher } from "@/lib/cypher-generator";
import { runQuery } from "@/lib/neo4j";
import { mapNeo4jToGraph } from "@/lib/graph-mapper";
import { getVertical } from "@/verticals/registry";
import { PLANS } from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const body = await req.json();

    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const plan = PLANS[session.plan];
    const vertical = getVertical(session.vertical);

    // Plan gating: Starter gets basic text search, Pro+ gets LLM
    if (plan.searchType === "basic") {
      return handleBasicSearch(parsed.data.query, session.tenantId, vertical);
    }

    // LLM → Cypher
    const result = await generateCypher(
      parsed.data.query,
      session.tenantId,
      session.vertical,
      Math.min(parsed.data.limit, plan.maxGraphNodes)
    );

    if (!result.isValid) {
      return handleBasicSearch(parsed.data.query, session.tenantId, vertical);
    }

    const records = await runQuery(result.cypher);
    const graph = mapNeo4jToGraph(records, vertical);

    return NextResponse.json({
      query: parsed.data.query,
      cypher: result.cypher,
      cypher_confidence: result.cypher_confidence,
      interpretation: result.interpretation,
      results: graph,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function handleBasicSearch(
  query: string,
  tenantId: string,
  vertical: ReturnType<typeof getVertical>
) {
  const records = await runQuery(
    `
    MATCH (p:Profile {_tenant: $tenantId})
    WHERE p.name CONTAINS $query OR p.profile_id CONTAINS $query
    OPTIONAL MATCH (p)-[r]-(connected)
    WHERE connected._tenant = $tenantId
    RETURN p, r, connected
    LIMIT 25
    `,
    { query, tenantId }
  );

  const graph = mapNeo4jToGraph(records, vertical);
  return NextResponse.json({
    query,
    cypher: "basic text search",
    cypher_confidence: 1.0,
    interpretation: `Text search for "${query}"`,
    results: graph,
  });
}
