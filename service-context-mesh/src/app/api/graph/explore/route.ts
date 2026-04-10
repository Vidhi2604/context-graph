export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";
import { mapNeo4jToGraph } from "@/lib/graph-mapper";
import { getVertical } from "@/verticals/registry";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const { node_id, node_label, depth = 2, limit = 50 } = await req.json();

    if (!node_id || !node_label) {
      return NextResponse.json(
        { error: "node_id and node_label required" },
        { status: 400 }
      );
    }

    const idField = getIdField(node_label);
    const records = await runQuery(
      `
      MATCH (center:${node_label} {${idField}: $nodeId, _tenant: $tenantId})
      OPTIONAL MATCH path = (center)-[*1..${Math.min(depth, 3)}]-(connected)
      WHERE ALL(n IN nodes(path) WHERE n._tenant = $tenantId)
      RETURN path
      LIMIT $limit
      `,
      { nodeId: node_id, tenantId: session.tenantId, limit }
    );

    const vertical = getVertical(session.vertical);
    const graph = mapNeo4jToGraph(records, vertical, node_id);

    return NextResponse.json(graph);
  } catch (error) {
    return errorResponse(error);
  }
}

function getIdField(label: string): string {
  const map: Record<string, string> = {
    Profile: "profile_id",
    Event: "id",
    Visit: "visit_id",
    Product: "product_id",
    Policy: "policy_id",
    Protocol: "protocol_id",
    Agent: "agent_id",
    Provider: "provider_id",
    Payment: "payment_id",
    Outcome: "outcome_id",
    Commitment: "commitment_id",
    Identity: "identity_id",
    Diagnosis: "diagnosis_id",
    Treatment: "treatment_id",
    Medication: "medication_id",
    InsuranceClaim: "claim_id",
    Department: "department_id",
    Session: "session_id",
  };
  return map[label] || "id";
}
