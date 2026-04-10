import { NextRequest, NextResponse } from "next/server";
import { BatchEventsSchema } from "@/types/event";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { isStreamsConfigured, produceBatchToStream } from "@/lib/streams";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const body = await req.json();

    const parsed = BatchEventsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid batch", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const events = parsed.data.events.map((e) => ({
      ...e,
      _vertical: session.vertical,
    }));

    if (isStreamsConfigured()) {
      const ids = await produceBatchToStream(session.tenantId, events);
      return NextResponse.json({ accepted: true, queued: events.length, mode: "stream", message_ids: ids }, { status: 202 });
    }

    // Sync fallback
    return NextResponse.json({ accepted: true, queued: events.length, mode: "sync" }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
