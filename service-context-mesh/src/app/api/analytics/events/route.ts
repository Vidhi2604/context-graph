export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";

export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const t = session.tenantId;

    const toNum = (v: unknown): number => {
      if (typeof v === "number") return v;
      if (v && typeof v === "object" && "low" in v) return (v as { low: number }).low;
      return 0;
    };

    const rows = await runQuery<{ type: string; count: unknown }>(
      `MATCH (e {_tenant: $t}) WHERE e:Event OR e:Visit
       RETURN coalesce(e.event_type, e.type, e.visit_type, labels(e)[0]) AS type,
              count(e) AS count
       ORDER BY count DESC
       LIMIT 15`,
      { t }
    );

    return NextResponse.json({
      rows: rows.map((r) => ({ type: String(r.type || "unknown"), count: toNum(r.count) })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
