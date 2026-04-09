import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";

export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const t = session.tenantId;

    const [events, profiles, identities, commitments, confidence] = await Promise.all([
      runQuery<{ count: number }>(
        `MATCH (e {_tenant: $t}) WHERE e:Event OR e:Visit RETURN count(e) AS count`, { t }
      ),
      runQuery<{ count: number }>(
        `MATCH (p:Profile {_tenant: $t}) RETURN count(p) AS count`, { t }
      ),
      runQuery<{ count: number }>(
        `MATCH (i:Identity {_tenant: $t}) RETURN count(i) AS count`, { t }
      ),
      runQuery<{ status: string; count: number }>(
        `MATCH (c:Commitment {_tenant: $t}) RETURN c.status AS status, count(c) AS count`, { t }
      ),
      runQuery<{ avg_confidence: number; total: number }>(
        `MATCH (e {_tenant: $t}) WHERE e.confidence_score IS NOT NULL
         RETURN round(avg(e.confidence_score), 2) AS avg_confidence, count(e) AS total`, { t }
      ),
    ]);

    const commitmentStats: Record<string, number> = {};
    for (const c of commitments) {
      commitmentStats[c.status] = c.count;
    }

    return NextResponse.json({
      events_tracked: events[0]?.count || 0,
      profiles_resolved: profiles[0]?.count || 0,
      identity_fragments: identities[0]?.count || 0,
      commitments: commitmentStats,
      avg_extraction_confidence: confidence[0]?.avg_confidence || 0,
      total_scored_events: confidence[0]?.total || 0,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
