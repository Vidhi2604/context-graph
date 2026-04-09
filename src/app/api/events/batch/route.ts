import { NextRequest, NextResponse } from "next/server";
import { BatchEventsSchema } from "@/types/event";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { produceBatch } from "@/lib/kafka";

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

    await produceBatch(session.tenantId, events);

    return NextResponse.json(
      { accepted: true, queued: events.length },
      { status: 202 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
