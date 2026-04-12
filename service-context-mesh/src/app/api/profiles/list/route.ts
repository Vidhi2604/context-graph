import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";

export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const t = session.tenantId;
    const isRetail = session.vertical !== "healthcare";
    const eventLabel = isRetail ? "Event" : "Visit";
    const eventRel = isRetail ? "PERFORMED" : "HAD_VISIT";

    const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 100);
    const search = req.nextUrl.searchParams.get("search") || "";
    const offset = Math.floor((page - 1) * limit);

    const whereSearch = search
      ? `AND (toLower(p.name) CONTAINS toLower($search) OR toLower(p.email) CONTAINS toLower($search) OR toLower(p.city) CONTAINS toLower($search))`
      : "";

    const toVal = (v: unknown): unknown => {
      if (v && typeof v === "object" && "low" in v) return (v as { low: number }).low;
      if (v && typeof v === "object" && "year" in v) {
        const d = v as Record<string, { low: number }>;
        return `${d.year.low}-${String(d.month.low).padStart(2,"0")}-${String(d.day.low).padStart(2,"0")}`;
      }
      return v;
    };

    const records = await runQuery<Record<string, unknown>>(
      `MATCH (p:Profile {_tenant: $t})
       WHERE 1=1 ${whereSearch}
       OPTIONAL MATCH (p)-[:${eventRel}]->(e:${eventLabel} {_tenant: $t})
       WITH p, count(e) AS event_count
       RETURN
         p.profile_id AS profile_id,
         p.name AS name,
         p.email AS email,
         p.phone AS phone,
         p.city AS city,
         p.tier AS tier,
         p.ltv AS ltv,
         p.created_at AS created_at,
         event_count
       ORDER BY event_count DESC, p.created_at DESC
       SKIP toInteger($offset) LIMIT toInteger($limit)`,
      { t, search, offset, limit }
    );

    const countResult = await runQuery<{ total: unknown }>(
      `MATCH (p:Profile {_tenant: $t}) WHERE 1=1 ${whereSearch} RETURN count(p) AS total`,
      { t, search }
    );

    const total = (() => {
      const v = countResult[0]?.total;
      if (!v) return 0;
      if (typeof v === "number") return v;
      if (typeof v === "object" && "low" in (v as object)) return (v as { low: number }).low;
      return Number(v);
    })();

    const profiles = records.map(r => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) clean[k] = toVal(v);
      return clean;
    });

    return NextResponse.json({ profiles, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    return errorResponse(error);
  }
}
