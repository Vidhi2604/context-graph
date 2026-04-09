import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse, ApiError } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";
import { chatCompletion } from "@/lib/groq";
import { PLANS } from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const plan = PLANS[session.plan];

    if (plan.insightLevel !== "full") {
      throw new ApiError(403, "Pattern discovery requires Enterprise plan");
    }

    const { min_cluster_size = 3 } = await req.json();
    const t = session.tenantId;

    // Find clusters of events sharing common connections
    const nodeLabel = session.vertical === "retail" ? "Event" : "Visit";
    const sharedRel = session.vertical === "retail" ? "INVOLVES" : "DIAGNOSED_WITH";

    const clusters = await runQuery<{
      shared_name: string;
      event_count: number;
      event_types: string[];
      profiles: string[];
    }>(
      `
      MATCH (e:${nodeLabel} {_tenant: $t})-[:${sharedRel}]->(shared)
      WITH shared, collect(e) AS events, count(e) AS cnt
      WHERE cnt >= $minSize
      UNWIND events AS e
      OPTIONAL MATCH (p:Profile)-[:PERFORMED|HAD_VISIT]->(e)
      RETURN shared.name AS shared_name, cnt AS event_count,
             collect(DISTINCT e.event_type) AS event_types,
             collect(DISTINCT p.name) AS profiles
      ORDER BY event_count DESC
      LIMIT 10
      `,
      { t, minSize: min_cluster_size }
    );

    if (clusters.length === 0) {
      return NextResponse.json({ patterns: [], message: "No patterns found with current data" });
    }

    // LLM generates summaries for each cluster
    const clusterSummary = clusters.map((c) =>
      `Cluster: ${c.shared_name} — ${c.event_count} events, types: ${c.event_types.join(", ")}, profiles: ${c.profiles.slice(0, 5).join(", ")}`
    ).join("\n");

    const raw = await chatCompletion(
      `You are analyzing pattern clusters in a ${session.vertical} context graph. For each cluster, provide a 1-sentence summary and a recommendation. Return JSON: { "patterns": [{ "cluster": "name", "summary": "...", "recommendation": "..." }] }`,
      clusterSummary,
      { jsonMode: true }
    );

    let parsed: { patterns?: { summary?: string; recommendation?: string }[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // LLM returned invalid JSON — fall back to auto-generated summaries
    }

    const patterns = clusters.map((c, i) => ({
      cluster_id: i + 1,
      cluster_size: c.event_count,
      shared_entity: c.shared_name,
      event_types: c.event_types,
      profiles: c.profiles.slice(0, 5),
      summary: parsed.patterns?.[i]?.summary || `${c.event_count} events related to ${c.shared_name}`,
      recommendation: parsed.patterns?.[i]?.recommendation || "Review this pattern",
    }));

    return NextResponse.json({ patterns });
  } catch (error) {
    return errorResponse(error);
  }
}
