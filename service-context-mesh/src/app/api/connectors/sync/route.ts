import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { getAdapter, getConnector, getConnectors } from "@/lib/connectors/registry";
import { isStreamsConfigured, produceToStream } from "@/lib/streams";
import { ConnectorTypeSchema } from "@/types/connector";
import { processEventsBatch } from "@/lib/process-events";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const { connector_id, type, since, credentials } = await req.json();

    const startedAt = new Date().toISOString();

    let events;

    if (connector_id) {
      const config = await getConnector(session.tenantId, connector_id);
      if (!config) {
        return NextResponse.json({ error: "Connector not found" }, { status: 404 });
      }
      const adapter = getAdapter(config.type);
      events = await adapter.sync(config.credentials, since);
    } else if (type) {
      const parsed = ConnectorTypeSchema.safeParse(type);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid connector type" }, { status: 400 });
      }
      const adapter = getAdapter(parsed.data);
      events = await adapter.sync(credentials || {}, since);
    } else {
      const connectors = await getConnectors(session.tenantId);
      if (connectors.length === 0) {
        const nurixAdapter = getAdapter("nurix");
        events = await nurixAdapter.sync({});
      } else {
        const allEvents = await Promise.all(
          connectors.map((c) => getAdapter(c.type).sync(c.credentials, since))
        );
        events = allEvents.flat();
      }
    }

    // Produce to Redis Streams (if configured) or process directly
    let eventsIngested = 0;
    let eventsFailed = 0;

    // Tag source for all events
    const ingestSource = connector_id
      ? (await getConnector(session.tenantId, connector_id))?.type || type || "connector"
      : type || "connector";

    const taggedEvents = events.map(e => ({ ...e, _vertical: session.vertical, _ingest_source: ingestSource }));

    if (isStreamsConfigured()) {
      for (const event of taggedEvents) {
        try {
          await produceToStream(session.tenantId, event);
          eventsIngested++;
        } catch {
          eventsFailed++;
        }
      }
      // Auto-drain the stream immediately after pushing
      try {
        const result = await processEventsBatch(taggedEvents, session.tenantId, session.orgId, session.vertical);
        eventsIngested = result.processed;
        eventsFailed = result.failed;
      } catch (e) {
        console.error("[connector sync] auto-drain error:", e);
      }
    } else {
      // Process events directly using the same logic as events/process
      try {
        console.log(`[sync] calling processEventsBatch with ${taggedEvents.length} events, tenant: ${session.tenantId}`);
        const result = await processEventsBatch(taggedEvents, session.tenantId, session.orgId, session.vertical);
        eventsIngested = result.processed;
        eventsFailed = result.failed;
      } catch (e) {
        console.error("[connector sync] process error:", e);
        eventsFailed = events.length;
      }
    }

    return NextResponse.json({
      sync_result: {
        events_synced: events.length,
        events_failed: eventsFailed,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      },
      pipeline_result: {
        events_pushed: events.length,
        events_ingested: eventsIngested,
        events_failed: eventsFailed,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
