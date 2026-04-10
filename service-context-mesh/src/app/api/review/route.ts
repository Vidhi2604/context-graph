export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { getQueue, getQueueStats, resolveItem, getQueueItem } from "@/lib/review-queue";
import { auditLog } from "@/lib/audit-log";

// GET /api/review — list pending review items
export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as "pending" | "approved" | "rejected" | undefined;

    const items = getQueue(session.tenantId, status || "pending");
    const stats = getQueueStats(session.tenantId);

    return NextResponse.json({ items, stats });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/review — approve or reject an item
export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const { id, decision, reviewed_by } = await req.json();

    if (!id || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json({ error: "id and decision (approved|rejected) required" }, { status: 400 });
    }

    const item = getQueueItem(id);
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    if (item.tenantId !== session.tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updated = resolveItem(id, decision, reviewed_by || session.userId);
    if (!updated) return NextResponse.json({ error: "Item already resolved" }, { status: 409 });

    auditLog({
      tenant_id: session.tenantId,
      action: decision === "approved" ? "review_approved" : "review_rejected",
      actor: reviewed_by || session.userId || "unknown",
      resource_type: "Event",
      resource_id: id,
      metadata: { event_type: item.event_type, confidence: item.confidence_score, source: item.source },
    });

    // If approved, forward to event processor
    if (decision === "approved") {
      const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      await fetch(`${baseUrl}/api/events/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-org-id": session.orgId,
        },
        body: JSON.stringify({
          events: [{
            ...item.payload,
            confidence_score: 0.9, // reviewer approved → bump confidence
            _source: item.source,
          }],
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
