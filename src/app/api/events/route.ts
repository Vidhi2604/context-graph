import { NextRequest, NextResponse } from "next/server";
import { RetailEventSchema, HealthcareEventSchema } from "@/types/event";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { isStreamsConfigured, produceToStream } from "@/lib/streams";

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

    const syncMode = req.nextUrl.searchParams.get("sync") === "true";

    // 1. Try Redis Streams (primary async pipeline)
    if (!syncMode && isStreamsConfigured()) {
      const messageId = await produceToStream(session.tenantId, eventPayload);
      return NextResponse.json({
        accepted: true,
        mode: "stream",
        message_id: messageId,
        stream: `stream:${session.tenantId}`,
      }, { status: 202 });
    }

    // 2. Sync fallback — process directly
    const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    await fetch(`${baseUrl}/api/events/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-org-id": session.orgId,
        "x-cron-secret": process.env.CRON_SECRET || "dev",
      },
      body: JSON.stringify({ events: [eventPayload], tenantId: session.tenantId }),
    }).catch(() => {});

    return NextResponse.json({ accepted: true, mode: "sync" }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
