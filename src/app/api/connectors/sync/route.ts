import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { getAdapter, getConnector, getConnectors } from "@/lib/connectors/registry";
import { produceEvent } from "@/lib/kafka";
import { ConnectorTypeSchema } from "@/types/connector";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const { connector_id, type, since, credentials } = await req.json();

    const startedAt = new Date().toISOString();

    let events;

    if (connector_id) {
      // Sync a specific configured connector
      const config = getConnector(session.tenantId, connector_id);
      if (!config) {
        return NextResponse.json({ error: "Connector not found" }, { status: 404 });
      }
      const adapter = getAdapter(config.type);
      events = await adapter.sync(config.credentials, since);
    } else if (type) {
      // Sync by type with provided credentials (or defaults for nurix)
      const parsed = ConnectorTypeSchema.safeParse(type);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid connector type" }, { status: 400 });
      }
      const adapter = getAdapter(parsed.data);
      events = await adapter.sync(credentials || {}, since);
    } else {
      // Sync ALL configured connectors
      const connectors = getConnectors(session.tenantId);
      if (connectors.length === 0) {
        // Default: load Nurix samples
        const nurixAdapter = getAdapter("nurix");
        events = await nurixAdapter.sync({});
      } else {
        const allEvents = await Promise.all(
          connectors.map((c) => getAdapter(c.type).sync(c.credentials, since))
        );
        events = allEvents.flat();
      }
    }

    // Produce all events to Kafka
    let eventsIngested = 0;
    let eventsFailed = 0;

    for (const event of events) {
      try {
        await produceEvent(session.tenantId, {
          ...event,
          _vertical: session.vertical,
        });
        eventsIngested++;
      } catch {
        eventsFailed++;
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
