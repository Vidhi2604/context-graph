import { NextRequest, NextResponse } from "next/server";
import { TranscriptSchema } from "@/types/event";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { extractFromTranscript } from "@/lib/transcript-extractor";
import { produceEvent } from "@/lib/kafka";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const body = await req.json();

    const parsed = TranscriptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid transcript", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Extract structured events from transcript via LLM
    const extracted = await extractFromTranscript(parsed.data, session.vertical);

    // Produce extracted events to Kafka
    for (const event of extracted.events) {
      await produceEvent(session.tenantId, {
        event_type: event.event_type,
        identifiers: extracted.identifiers,
        profile_data: extracted.profile_data,
        confidence_score: event.confidence_score,
        properties: event.properties,
        product: event.product,
        payment: event.payment,
        policy: event.policy,
        agent: event.agent,
        visit: event.visit,
        diagnosis: event.diagnosis,
        treatment: event.treatment,
        provider: event.provider,
        protocol: event.protocol,
        source: "voice_stt",
        call_id: parsed.data.call_id,
        _vertical: session.vertical,
      });
    }

    // Produce commitments as events
    for (const commitment of extracted.commitments) {
      await produceEvent(session.tenantId, {
        event_type: "commitment_made",
        identifiers: extracted.identifiers,
        properties: commitment,
        source: "voice_stt",
        call_id: parsed.data.call_id,
        _vertical: session.vertical,
      });
    }

    return NextResponse.json(
      {
        accepted: true,
        call_id: parsed.data.call_id,
        events_extracted: extracted.events.length,
        commitments_extracted: extracted.commitments.length,
        sentiment: extracted.sentiment,
      },
      { status: 202 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
