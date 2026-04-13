import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const body = await req.json();
    const { node_id, node_label } = body;
    const limit = Math.floor(Number(body.limit) || 5);

    if (!node_id || !node_label) {
      return NextResponse.json(
        { error: "node_id and node_label required" },
        { status: 400 }
      );
    }

    const idField = node_label === "Profile" ? "profile_id"
      : node_label === "Visit" ? "visit_id" : "id";

    const relType = session.vertical === "retail" ? "PERFORMED" : "HAD_VISIT";
    const detailRel = session.vertical === "retail" ? "INVOLVES" : "DIAGNOSED_WITH";

    let similar;
    if (node_label === "Profile") {
      similar = await runQuery(
        `MATCH (source:Profile {${idField}: $nodeId, _tenant: $tenantId})
         OPTIONAL MATCH (source)-[:${relType}]->(e)-[:${detailRel}]->(shared)
         WITH source, collect(DISTINCT shared) AS source_connections
         UNWIND source_connections AS sc
         MATCH (other:Profile {_tenant: $tenantId})-[:${relType}]->(e2)-[:${detailRel}]->(sc)
         WHERE other.profile_id <> source.profile_id
         WITH other, count(DISTINCT sc) AS shared_count
         ORDER BY shared_count DESC LIMIT toInteger($limit)
         OPTIONAL MATCH (other)-[:${relType}]->(e3)
         RETURN other, shared_count, collect(e3)[0..3] AS sample_events`,
        { nodeId: node_id, tenantId: session.tenantId, limit }
      );
    } else {
      similar = await runQuery(
        `MATCH (source:${node_label} {${idField}: $nodeId, _tenant: $tenantId})
         OPTIONAL MATCH (source)-[:${detailRel}]->(shared)
         WITH source, collect(DISTINCT shared) AS source_connections
         UNWIND source_connections AS sc
         MATCH (other:${node_label} {_tenant: $tenantId})-[:${detailRel}]->(sc)
         WHERE other.${idField} <> source.${idField}
         WITH other, count(DISTINCT sc) AS shared_count
         ORDER BY shared_count DESC LIMIT toInteger($limit)
         RETURN other, shared_count`,
        { nodeId: node_id, tenantId: session.tenantId, limit }
      );
    }

    return NextResponse.json({
      source: { node_id, node_label },
      similar: similar.map((r: Record<string, unknown>) => ({
        node: r.other,
        shared_connections: r.shared_count,
        sample_events: r.sample_events || [],
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
