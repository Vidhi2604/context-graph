import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";

export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const t = session.tenantId;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // open | breached | fulfilled | all

    const toNum = (v: unknown): number => {
      if (typeof v === "number") return v;
      if (v && typeof v === "object" && "low" in v) return (v as { low: number }).low;
      return 0;
    };

    const whereClause = status && status !== "all"
      ? `AND c.status = $status`
      : "";

    const rows = await runQuery<{
      id: string;
      promise: string;
      deadline: string;
      status: string;
      assignee: string;
      confidence: unknown;
      profile_id: string;
      customer_name: string;
    }>(
      `MATCH (c:Commitment {_tenant: $t})
       OPTIONAL MATCH (p:Profile {_tenant: $t})-[:MADE_COMMITMENT]->(c)
       WHERE 1=1 ${whereClause}
       RETURN
         c.id AS id,
         c.promise_text AS promise,
         c.deadline AS deadline,
         c.status AS status,
         c.assignee AS assignee,
         c.confidence_score AS confidence,
         p.id AS profile_id,
         p.name AS customer_name
       ORDER BY
         CASE c.status WHEN 'breached' THEN 0 WHEN 'open' THEN 1 ELSE 2 END,
         c.deadline ASC
       LIMIT 100`,
      { t, ...(status && status !== "all" ? { status } : {}) }
    );

    const commitments = rows.map((r) => ({
      id: r.id || "",
      promise: r.promise || "",
      deadline: r.deadline ? String(r.deadline) : "",
      status: r.status || "open",
      assignee: r.assignee || "",
      confidence: toNum(r.confidence),
      profile_id: r.profile_id || "",
      customer_name: r.customer_name || "",
    }));

    const counts = {
      all: commitments.length,
      open: commitments.filter((c) => c.status === "open").length,
      breached: commitments.filter((c) => c.status === "breached").length,
      fulfilled: commitments.filter((c) => c.status === "fulfilled").length,
    };

    return NextResponse.json({ commitments, counts });
  } catch (error) {
    return errorResponse(error);
  }
}
