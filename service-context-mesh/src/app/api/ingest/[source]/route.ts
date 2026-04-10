import { NextRequest, NextResponse } from "next/server";
import { getOrgFromApiKey, errorResponse } from "@/lib/api-auth";
import { getAdapter } from "@/lib/connectors/registry";
import { produceToStream } from "@/lib/streams";
import { ConnectorType } from "@/types/connector";
import { logActivity, completeActivity } from "@/lib/activity-log";

export async function POST(
  req: NextRequest,
  { params }: { params: { source: string } }
) {
  try {
    const source = params.source as ConnectorType;
    const adapter = getAdapter(source);

    // Webhooks auth via API key
    const session = await getOrgFromApiKey(req);

    const payload = await req.json();

    // Map webhook payload to ContextMesh events
    const events = adapter.mapWebhook(payload);

    if (events.length === 0) {
      return NextResponse.json({ accepted: true, events_mapped: 0, message: "No mappable events in payload" });
    }

    let ingested = 0;
    let failed = 0;
    const groupId = `ingest_${Date.now()}`;

    const ingestId = logActivity(session.tenantId, {
      layer: "ingest",
      label: `Webhook received · ${source}`,
      detail: `${events.length} events mapped`,
      status: "running",
      started_at: Date.now(),
      group_id: groupId,
    });

    for (const event of events) {
      const redisId = logActivity(session.tenantId, {
        layer: "redis",
        label: "Redis XADD",
        detail: `stream:${session.tenantId} · ${String(event.event_type || "event")}`,
        status: "running",
        started_at: Date.now(),
        group_id: groupId,
      });
      try {
        const streamId = await produceToStream(session.tenantId, {
          ...event,
          _vertical: session.vertical,
        });
        completeActivity(session.tenantId, redisId, "success", `msg_id: ${streamId}`);
        ingested++;
      } catch (e) {
        completeActivity(session.tenantId, redisId, "error", e instanceof Error ? e.message : "stream error");
        failed++;
      }
    }

    completeActivity(session.tenantId, ingestId, failed === events.length ? "error" : "success",
      `${ingested} pushed to stream, ${failed} failed`);

    return NextResponse.json({
      accepted: true,
      source,
      events_mapped: events.length,
      events_ingested: ingested,
      events_failed: failed,
    }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
