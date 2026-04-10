export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";

export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const t = session.tenantId;
    const isHealthcare = session.vertical === "healthcare";

    const toNum = (v: unknown): number => {
      if (typeof v === "number") return v;
      if (v && typeof v === "object" && "low" in v) return (v as { low: number }).low;
      return 0;
    };

    if (isHealthcare) {
      // Healthcare: provider performance
      const rows = await runQuery<{
        name: string;
        department: string;
        handled: unknown;
        exceptions: unknown;
        readmissions: unknown;
      }>(
        `MATCH (p:Provider {_tenant: $t})<-[:ATTENDED_BY]-(v:Visit {_tenant: $t})
         OPTIONAL MATCH (v)-[:HAS_DIAGNOSIS]->(d:Diagnosis {_tenant: $t})
           WHERE d.deviated = true OR d.exception = true
         OPTIONAL MATCH (p2:Profile {_tenant: $t})-[:HAD_VISIT]->(v2:Visit {_tenant: $t})-[:ATTENDED_BY]->(p)
           WHERE v2.readmission = true
         RETURN
           p.name AS name,
           p.department AS department,
           count(DISTINCT v) AS handled,
           count(DISTINCT CASE WHEN d.deviated = true OR d.exception = true THEN v END) AS exceptions,
           count(DISTINCT CASE WHEN v2.readmission = true THEN v2 END) AS readmissions`,
        { t }
      );

      const agents = rows.map((r) => {
        const handled = toNum(r.handled);
        const exceptions = toNum(r.exceptions);
        const readmissions = toNum(r.readmissions);
        const exceptionRate = handled > 0 ? exceptions / handled : 0;
        const recoveryRate = handled > 0 ? Math.max(0, 1 - readmissions / Math.max(handled, 1)) : 0;
        return {
          name: r.name || "Unknown Provider",
          role: r.department || "General",
          handled,
          exception_rate: Math.round(exceptionRate * 100) / 100,
          retention_rate: Math.round(recoveryRate * 100) / 100,
        };
      }).filter((a) => a.handled > 0)
        .sort((a, b) => b.handled - a.handled)
        .slice(0, 20);

      return NextResponse.json({ agents, vertical: "healthcare" });
    } else {
      // Retail: agent performance
      const rows = await runQuery<{
        name: string;
        role: string;
        handled: unknown;
        exceptions: unknown;
        retained: unknown;
      }>(
        `MATCH (a:Agent {_tenant: $t})<-[:HANDLED_BY]-(e:Event {_tenant: $t})
         OPTIONAL MATCH (a)<-[:HANDLED_BY]-(ex:Event {_tenant: $t})
           WHERE ex.exception = true OR ex.deviated = true
         OPTIONAL MATCH (a)<-[:HANDLED_BY]-(re:Event {_tenant: $t})-[:FOR_PROFILE]->(prof:Profile {_tenant: $t})
           WHERE re.event_type IN ["purchase", "add_to_cart"]
         RETURN
           a.name AS name,
           a.role AS role,
           count(DISTINCT e) AS handled,
           count(DISTINCT CASE WHEN ex.exception = true OR ex.deviated = true THEN ex END) AS exceptions,
           count(DISTINCT CASE WHEN re.event_type IN ["purchase", "add_to_cart"] THEN prof END) AS retained`,
        { t }
      );

      const agents = rows.map((r) => {
        const handled = toNum(r.handled);
        const exceptions = toNum(r.exceptions);
        const retained = toNum(r.retained);
        return {
          name: r.name || "Unknown Agent",
          role: r.role || "Agent",
          handled,
          exception_rate: handled > 0 ? Math.round((exceptions / handled) * 100) / 100 : 0,
          retention_rate: handled > 0 ? Math.round((retained / Math.max(handled, 1)) * 100) / 100 : 0,
        };
      }).filter((a) => a.handled > 0)
        .sort((a, b) => b.handled - a.handled)
        .slice(0, 20);

      return NextResponse.json({ agents, vertical: "retail" });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
