import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { logActivity, completeActivity } from "@/lib/activity-log";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const { url, payload } = await req.json();

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json({ error: "Valid URL required" }, { status: 400 });
    }

    const domain = (() => { try { return new URL(url).hostname; } catch { return url; } })();
    const actId = logActivity(session.tenantId, {
      layer: "ingest",
      label: "Webhook Fire",
      detail: `POST → ${domain}${payload?.event ? ` (${payload.event})` : ""}`,
      status: "running",
      started_at: Date.now(),
    });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      completeActivity(session.tenantId, actId, res.ok ? "success" : "error", `${res.status} ${res.ok ? "OK" : "Error"}`);
      return NextResponse.json({ status: res.status, ok: res.ok });
    } catch (fetchErr) {
      completeActivity(session.tenantId, actId, "error", "Connection failed");
      throw fetchErr;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
