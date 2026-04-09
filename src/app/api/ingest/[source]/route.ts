import { NextRequest, NextResponse } from "next/server";
import { getOrgFromApiKey, errorResponse } from "@/lib/api-auth";
import { getAdapter } from "@/lib/connectors/registry";
import { produceEvent } from "@/lib/kafka";
import { ConnectorType } from "@/types/connector";

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

    // Produce all events to Kafka
    let ingested = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await produceEvent(session.tenantId, {
          ...event,
          _vertical: session.vertical,
        });
        ingested++;
      } catch {
        failed++;
      }
    }

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
