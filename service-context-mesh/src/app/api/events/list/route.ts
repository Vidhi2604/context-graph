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
    const eventType = req.nextUrl.searchParams.get("event_type") || "";
    const offset = Math.floor((page - 1) * limit);

    const toVal = (v: unknown): unknown => {
      if (v && typeof v === "object" && "low" in v) return (v as { low: number }).low;
      if (v && typeof v === "object" && "year" in v) {
        // Neo4j DateTime
        const d = v as Record<string, { low: number }>;
        return `${d.year.low}-${String(d.month.low).padStart(2,"0")}-${String(d.day.low).padStart(2,"0")} ${String(d.hour.low).padStart(2,"0")}:${String(d.minute.low).padStart(2,"0")}`;
      }
      return v;
    };

    const whereSearch = search ? `AND (toLower(p.name) CONTAINS toLower($search) OR toLower(p.email) CONTAINS toLower($search))` : "";
    const whereType = eventType ? `AND e.event_type = $eventType` : "";

    const records = await runQuery<Record<string, unknown>>(
      `MATCH (p:Profile {_tenant: $t})-[:${eventRel}]->(e:${eventLabel} {_tenant: $t})
       WHERE 1=1 ${whereSearch} ${whereType}
       RETURN
         p.profile_id AS profile_id,
         p.name AS profile_name,
         p.email AS email,
         p.city AS city,
         p.tier AS tier,
         e.${isRetail ? "id" : "visit_id"} AS event_id,
         e.event_type AS event_type,
         e.timestamp AS timestamp,
         e.status AS status,
         e.amount AS amount,
         e.channel AS channel,
         e.confidence_score AS confidence,
         e.properties AS properties
       ORDER BY e.timestamp DESC
       SKIP toInteger($offset) LIMIT toInteger($limit)`,
      { t, search, eventType, offset, limit }
    );

    const countResult = await runQuery<{ total: unknown }>(
      `MATCH (p:Profile {_tenant: $t})-[:${eventRel}]->(e:${eventLabel} {_tenant: $t})
       WHERE 1=1 ${whereSearch} ${whereType}
       RETURN count(e) AS total`,
      { t, search, eventType }
    );

    const total = (() => {
      const v = countResult[0]?.total;
      if (!v) return 0;
      if (typeof v === "number") return v;
      if (typeof v === "object" && "low" in (v as object)) return (v as { low: number }).low;
      return Number(v);
    })();

    const events = records.map(r => {
      const props: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) props[k] = toVal(v);
      // Parse properties JSON if string
      if (typeof props.properties === "string") {
        try { props.properties = JSON.parse(props.properties as string); } catch { /**/ }
      }
      return props;
    });

    // Get distinct event types for filter
    const typeRecords = await runQuery<{ et: string }>(
      `MATCH (e:${eventLabel} {_tenant: $t}) WHERE e.event_type IS NOT NULL RETURN DISTINCT e.event_type AS et LIMIT 20`,
      { t }
    );

    return NextResponse.json({
      events,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      event_types: typeRecords.map(r => r.et).filter(Boolean),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
