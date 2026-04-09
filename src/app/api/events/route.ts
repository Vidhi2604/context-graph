import { NextRequest, NextResponse } from "next/server";
import { RetailEventSchema, HealthcareEventSchema } from "@/types/event";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { produceEvent } from "@/lib/kafka";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const body = await req.json();

    // Validate based on vertical
    const schema = session.vertical === "retail" ? RetailEventSchema : HealthcareEventSchema;
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid event", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Produce to Kafka
    await produceEvent(session.tenantId, {
      ...parsed.data,
      _vertical: session.vertical,
    });

    return NextResponse.json(
      { accepted: true, message: "Event queued for processing" },
      { status: 202 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
