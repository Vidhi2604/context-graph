import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { getConfig } from "@/lib/ingest-configs";
import { mapRawPayload } from "@/lib/raw-mapper";
import { produceToStream, isStreamsConfigured } from "@/lib/streams";
import { TraceCollector } from "@/lib/trace";
import { logActivity, completeActivity } from "@/lib/activity-log";

/**
 * POST /api/ingest/raw
 *
 * Accepts ANY JSON payload — no schema required.
 * Use ?client=myntra to apply a specific field mapping config.
 * Falls back to auto-detection if no client specified.
 *
 * Examples:
 *   POST /api/ingest/raw?client=myntra
 *   POST /api/ingest/raw?client=care_hospitals
 *   POST /api/ingest/raw  (auto-detect)
 *
 * Single event:   { "email": "user@x.com", "event": "purchase", "amount": 499 }
 * Batch of events: [{ ... }, { ... }, ...]
 */
export async function POST(req: NextRequest) {
  try {
    const traceEnabled = req.nextUrl.searchParams.get("trace") === "true";
    const trace = traceEnabled ? new TraceCollector() : null;

    // Auth via API key
    const session = await (trace
      ? trace.run("Auth & Tenant Resolution", "getOrgFromRequest()", "auth",
          "API key in Authorization header",
          () => getOrgFromRequest(req))
      : getOrgFromRequest(req));

    // Get client config
    const clientKey = req.nextUrl.searchParams.get("client") || undefined;
    const config = await (trace
      ? trace.run("Load Field Mapping Config", "getConfig()", "mapping",
          `client: ${clientKey || "auto-detect (default)"}`,
          async () => getConfig(clientKey))
      : Promise.resolve(getConfig(clientKey)));

    // Parse body — accept single object or array
    const body = await req.json();
    const payloads: Record<string, unknown>[] = Array.isArray(body) ? body : [body];

    if (payloads.length === 0) {
      return NextResponse.json({ error: "Empty payload" }, { status: 400 });
    }

    if (payloads.length > 1000) {
      return NextResponse.json({ error: "Max 1000 events per request" }, { status: 400 });
    }

    // Map all payloads
    const mapActId = logActivity(session.tenantId, {
      layer: "mapping", label: "Field Mapping",
      detail: `${payloads.length} payload(s) · client: ${clientKey || "default"}`,
      status: "running", started_at: Date.now(),
    });
    const mapped = await (trace
      ? trace.run("Field Mapping", "mapRawPayload()", "mapping",
          `${payloads.length} payload(s), client: ${clientKey || "default"}`,
          async () => {
            const results = payloads.map(p => mapRawPayload(p, config, clientKey || "raw"));
            return results;
          })
      : Promise.resolve(payloads.map(p => mapRawPayload(p, config, clientKey || "raw"))))
        .then(results => results.map(e => e ? { ...e, _ingest_source: clientKey || "api" } : e));

    const validEvents = mapped.filter(Boolean);
    const firstEvent = validEvents[0] as unknown as Record<string, unknown> | undefined;
    const identifiers = (firstEvent?.identifiers || {}) as Record<string, string>;
    completeActivity(session.tenantId, mapActId, validEvents.length > 0 ? "success" : "error",
      `${validEvents.length}/${payloads.length} mapped · identifiers: ${Object.keys(identifiers).join(", ") || "none"}`, {
      total: payloads.length,
      mapped: validEvents.length,
      skipped: payloads.length - validEvents.length,
      client_config: clientKey || "default",
      sample_event_type: firstEvent?.event_type || null,
      sample_identifiers: Object.keys(identifiers),
    });
    const skipped = payloads.length - validEvents.length;

    if (validEvents.length === 0) {
      return NextResponse.json({
        error: "No valid events — could not extract any identifier (email, phone, user_id, mrn etc.) from payload",
        hint: "At least one identifier field is required. Pass ?client=myntra to use a specific mapping config.",
        skipped: payloads.length,
      }, { status: 422 });
    }

    const streamsConfigured = isStreamsConfigured();
    // Force sync when request comes from import UI (?sync=true) or always for dashboard imports
    const forceSync = req.nextUrl.searchParams.get("sync") === "true";

    let ingested = 0;
    let failed = 0;

    if (streamsConfigured && !forceSync) {
      // Async via Kafka
      await (trace
        ? trace.run("Kafka Produce", "produceBatch()", "kafka",
            `${validEvents.length} events → topic: events-${session.tenantId}`,
            async () => {
              for (const event of validEvents) {
                await produceToStream(session.tenantId, {
                  ...event,
                  _vertical: session.vertical,
                });
                ingested++;
              }
            })
        : (async () => {
            for (const event of validEvents) {
              try {
                await produceToStream(session.tenantId, { ...event!, _vertical: session.vertical });
                ingested++;
              } catch { failed++; }
            }
          })());
    } else {
      // Sync — process all events in one batch call
      const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      try {
        const res = await fetch(`${baseUrl}/api/events/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-org-id": session.orgId,
            "x-cron-secret": process.env.CRON_SECRET || "dev",
          },
          body: JSON.stringify({
            events: validEvents.map(e => ({ ...e, _vertical: session.vertical })),
            tenantId: session.tenantId,
          }),
        });
        if (res.ok) {
          const result = await res.json();
          ingested = result.processed ?? validEvents.length;
          failed = result.failed ?? 0;
        } else {
          failed = validEvents.length;
        }
      } catch {
        failed = validEvents.length;
      }
    }

    const response = {
      accepted: true,
      total_received: payloads.length,
      events_mapped: validEvents.length,
      events_ingested: ingested,
      events_failed: failed,
      events_skipped: skipped,
      mode: streamsConfigured ? "async" : "sync",
      client_config: clientKey || "default",
      ...(trace ? { _trace: trace.finalize("event_ingest", `raw ingest (${payloads.length} events)`) } : {}),
    };

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * GET /api/ingest/raw
 * Returns available client configs and field mapping documentation
 */
export async function GET() {
  const { getClientKeys } = await import("@/lib/ingest-configs");
  return NextResponse.json({
    endpoint: "POST /api/ingest/raw",
    description: "Accepts any JSON payload — no schema required",
    authentication: "Bearer <api_key> in Authorization header",
    query_params: {
      client: "Optional. One of the supported client configs. Omit for auto-detection.",
      trace: "Optional. Set to 'true' to see full pipeline trace in response.",
    },
    supported_clients: getClientKeys(),
    examples: {
      single_event: {
        url: "POST /api/ingest/raw?client=myntra",
        body: { customer_email: "priya@example.com", event_name: "order_placed", order_value: 8499, item_name: "Nike Air Max" },
      },
      batch_events: {
        url: "POST /api/ingest/raw?client=myntra",
        body: [
          { customer_email: "rahul@example.com", event_name: "add_to_basket", item_name: "Adidas Ultraboost" },
          { customer_email: "rahul@example.com", event_name: "order_placed", order_value: 12999, item_name: "Adidas Ultraboost" },
        ],
      },
      auto_detect: {
        url: "POST /api/ingest/raw",
        body: { email: "user@example.com", action: "purchase", amount: 999 },
      },
    },
  });
}
