import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const { node_id, node_label, limit = 5 } = await req.json();

    if (!node_id || !node_label) {
      return NextResponse.json(
        { error: "node_id and node_label required" },
        { status: 400 }
      );
    }

    const idField = node_label === "Profile" ? "profile_id"
      : node_label === "Visit" ? "visit_id" : "id";

    // Find similar by shared connections (structural similarity)
    const relType = session.vertical === "retail" ? "PERFORMED" : "HAD_VISIT";
    const detailRel = session.vertical === "retail" ? "INVOLVES" : "DIAGNOSED_WITH";

    const similar = await runQuery(
      `
      // Get the source node's connections
      MATCH (source:${node_label} {${idField}: $nodeId, _tenant: $tenantId})
      ${node_label === "Profile" ? `
        OPTIONAL MATCH (source)-[:${relType}]->(e)-[:${detailRel}]->(shared)
        WITH source, collect(DISTINCT shared) AS source_connections
        // Find other profiles sharing those connections
        UNWIND source_connections AS sc
        MATCH (other:Profile {_tenant: $tenantId})-[:${relType}]->(e2)-[:${detailRel}]->(sc)
        WHERE other.profile_id <> source.profile_id
        WITH source, other, count(DISTINCT sc) AS shared_count
        ORDER BY shared_count DESC
        LIMIT $limit
        OPTIONAL MATCH (other)-[:${relType}]->(e3)
        RETURN other, shared_count, collect(e3)[0..5] AS sample_events
      ` : `
        OPTIONAL MATCH (source)-[:${detailRel}]->(shared)
        WITH source, collect(DISTINCT shared) AS source_connections
        UNWIND source_connections AS sc
        MATCH (other:${node_label} {_tenant: $tenantId})-[:${detailRel}]->(sc)
        WHERE other.${idField} <> source.${idField}
        WITH source, other, count(DISTINCT sc) AS shared_count
        ORDER BY shared_count DESC
        LIMIT $limit
        RETURN other, shared_count
      `}
      `,
      { nodeId: node_id, tenantId: session.tenantId, limit }
    );

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
