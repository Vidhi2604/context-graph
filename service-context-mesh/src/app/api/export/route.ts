export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const t = session.tenantId;
    const mode = req.nextUrl.searchParams.get("mode") || "filtered"; // "filtered" or "full"
    const query = req.nextUrl.searchParams.get("query") || "";
    const isRetail = session.vertical === "retail";
    const eventLabel = isRetail ? "Event" : "Visit";
    const eventRel = isRetail ? "PERFORMED" : "HAD_VISIT";

    let rows: Record<string, unknown>[] = [];

    if (mode === "full") {
      // Export all profiles + events
      const records = await runQuery<Record<string, unknown>>(
        `MATCH (p:Profile {_tenant: $t})
         OPTIONAL MATCH (p)-[:${eventRel}]->(e:${eventLabel} {_tenant: $t})
         RETURN
           p.profile_id AS profile_id,
           p.name AS name,
           p.email AS email,
           p.phone AS phone,
           p.city AS city,
           p.tier AS tier,
           p.ltv AS ltv,
           e.event_type AS event_type,
           e.timestamp AS timestamp,
           e.status AS status,
           e.amount AS amount,
           e.channel AS channel,
           e.sentiment AS sentiment,
           e.issue_type AS issue_type,
           e.resolution AS resolution
         ORDER BY p.profile_id, e.timestamp
         LIMIT 10000`,
        { t }
      );
      rows = records.map(r => {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          clean[k] = v && typeof v === "object" && "low" in v ? (v as { low: number }).low : v;
        }
        return clean;
      });
    } else {
      // Filtered export — profiles + events matching a search query
      const searchTerm = query.toLowerCase();
      const records = await runQuery<Record<string, unknown>>(
        `MATCH (p:Profile {_tenant: $t})
         WHERE toLower(p.name) CONTAINS $q
            OR toLower(p.email) CONTAINS $q
            OR toLower(p.city) CONTAINS $q
            OR toLower(p.tier) CONTAINS $q
            OR $q = ''
         OPTIONAL MATCH (p)-[:${eventRel}]->(e:${eventLabel} {_tenant: $t})
         RETURN
           p.profile_id AS profile_id,
           p.name AS name,
           p.email AS email,
           p.phone AS phone,
           p.city AS city,
           p.tier AS tier,
           p.ltv AS ltv,
           e.event_type AS event_type,
           e.timestamp AS timestamp,
           e.status AS status,
           e.amount AS amount,
           e.channel AS channel,
           e.sentiment AS sentiment,
           e.issue_type AS issue_type,
           e.resolution AS resolution
         ORDER BY p.profile_id, e.timestamp
         LIMIT 5000`,
        { t, q: searchTerm }
      );
      rows = records.map(r => {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          clean[k] = v && typeof v === "object" && "low" in v ? (v as { low: number }).low : v;
        }
        return clean;
      });
    }

    const csv = toCSV(rows);
    const filename = `contextmesh-export-${mode}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
