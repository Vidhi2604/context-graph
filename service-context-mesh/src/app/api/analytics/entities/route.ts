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

    // Products/Diagnoses most referenced in events
    const rows = await runQuery<{ name: string; label: string; count: unknown }>(
      `MATCH (e {_tenant: $t})-[]->(n {_tenant: $t})
       WHERE (n:Product OR n:Diagnosis OR n:Agent OR n:Provider OR n:Policy)
         AND (e:Event OR e:Visit)
       RETURN
         coalesce(n.name, n.title, n.code, n.id) AS name,
         labels(n)[0] AS label,
         count(e) AS count
       ORDER BY count DESC
       LIMIT 12`,
      { t }
    );

    return NextResponse.json({
      rows: rows.map((r) => ({
        name: String(r.name || "Unknown"),
        label: String(r.label || "Node"),
        count: toNum(r.count),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
