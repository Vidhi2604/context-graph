export const dynamic = "force-dynamic";
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

    // Neo4j returns integers as { low: n, high: 0 } — convert to plain numbers
    const toNum = (v: unknown): number => {
      if (typeof v === "number") return v;
      if (v && typeof v === "object" && "low" in v) return (v as { low: number }).low;
      return 0;
    };

    const commitmentStats: Record<string, number> = {};
    for (const c of commitments) {
      commitmentStats[c.status] = toNum(c.count);
    }

    return NextResponse.json({
      events_tracked: toNum(events[0]?.count),
      profiles_resolved: toNum(profiles[0]?.count),
      identity_fragments: toNum(identities[0]?.count),
      commitments: commitmentStats,
      avg_extraction_confidence: toNum(confidence[0]?.avg_confidence),
      total_scored_events: toNum(confidence[0]?.total),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
