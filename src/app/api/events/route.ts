import { NextRequest, NextResponse } from "next/server";
import { RetailEventSchema, HealthcareEventSchema } from "@/types/event";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const { success } = await checkRateLimit(`events:${session.tenantId}`, 100, 60);
    if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const body = await req.json();

    const schema = session.vertical === "retail" ? RetailEventSchema : HealthcareEventSchema;
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid event", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const eventPayload = { ...parsed.data, _vertical: session.vertical };

    // ?sync=true — bypass Kafka and process directly (useful when Kafka isn't configured)
    const syncMode = req.nextUrl.searchParams.get("sync") === "true"
      || !process.env.UPSTASH_KAFKA_REST_URL;

    if (syncMode) {
      // Direct processing — call the consumer endpoint internally
      const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      await fetch(`${baseUrl}/api/events/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-org-id": session.orgId,
          "x-cron-secret": process.env.CRON_SECRET || "dev",
        },
        body: JSON.stringify({ events: [eventPayload], tenantId: session.tenantId }),
      }).catch(() => {}); // fire and forget

      return NextResponse.json({ accepted: true, mode: "sync" }, { status: 202 });
    }

    // Async via Kafka
    const { produceEvent } = await import("@/lib/kafka");
    await produceEvent(session.tenantId, eventPayload);

    return NextResponse.json({ accepted: true, message: "Event queued for processing" }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
