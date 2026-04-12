import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";
import { getCommitments } from "@/lib/commitment-tracker";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getOrgFromRequest(req);
    const profileId = params.id;
    const relType = session.vertical === "retail" ? "PERFORMED" : "HAD_VISIT";

    const [profile, events, commitments] = await Promise.all([
      runQuery(
        `
        MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
        OPTIONAL MATCH (p)-[:HAS_IDENTITY]->(i:Identity)
        RETURN p, collect(i) AS identities
        `,
        { profileId, tenantId: session.tenantId }
      ),
      runQuery(
        `
        MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
              -[:${relType}]->(e)
        OPTIONAL MATCH (e)-[:INVOLVES|DIAGNOSED_WITH]->(detail)
        OPTIONAL MATCH (e)-[:PAID_VIA|CLAIMED_VIA]->(financial)
        OPTIONAL MATCH (e)-[:HANDLED_BY|ATTENDED_BY]->(handler)
        OPTIONAL MATCH (e)-[:GOVERNED_BY|OVERRODE|DEVIATED_FROM]->(pol)
        RETURN e, detail, financial, handler, pol
        ORDER BY e.timestamp ASC
        `,
        { profileId, tenantId: session.tenantId }
      ),
      getCommitments(session.tenantId, profileId),
    ]);

    if (!profile[0]) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      profile: profile[0],
      events,
      commitments,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
