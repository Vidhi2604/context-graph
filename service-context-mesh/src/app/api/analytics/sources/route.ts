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

    const rows = await runQuery<{ source: string; count: unknown }>(
      `MATCH (e {_tenant: $t}) WHERE e:Event OR e:Visit
       RETURN coalesce(e.source, 'api') AS source, count(e) AS count
       ORDER BY count DESC
       LIMIT 10`,
      { t }
    );

    return NextResponse.json({
      rows: rows.map((r) => ({ source: String(r.source || "api"), count: toNum(r.count) })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
