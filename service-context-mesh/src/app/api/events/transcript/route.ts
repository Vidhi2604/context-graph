export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { TranscriptSchema } from "@/types/event";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { extractFromTranscript } from "@/lib/transcript-extractor";
import { rulesExtract, shouldUseLLM } from "@/lib/rules-extractor";
import { isStreamsConfigured, produceToStream } from "@/lib/streams";
import { classifyConfidence, enqueueForReview } from "@/lib/review-queue";
import { auditLog } from "@/lib/audit-log";

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

    const transcriptText = parsed.data.transcript
      .map((t) => `${t.speaker}: ${t.text}`)
      .join("\n");

    // ── Tiered Extraction Pipeline ────────────────────────────────
    // Tier 1: Rules engine — fast, free, high confidence
    const rulesResult = rulesExtract(transcriptText, session.vertical as "retail" | "healthcare");

    let extracted;
    let tier: "rules" | "llm";

    if (rulesResult.matched && !shouldUseLLM(transcriptText)) {
      // Tier 1 matched — use rules result, no LLM needed
      extracted = {
        identifiers: {},
        profile_data: {},
        events: [{
          event_type: rulesResult.event_type!,
          confidence_score: rulesResult.confidence_score,
          properties: rulesResult.properties,
        }],
        commitments: rulesResult.commitments || [],
        sentiment: { trajectory: "neutral", score: 0.5 },
      };
      tier = "rules";
    } else {
      // Tier 2: Full LLM extraction
      extracted = await extractFromTranscript(parsed.data, session.vertical);
      tier = "llm";
    }

    // ── Confidence Gates + Queue/Stream ──────────────────────────
    let autoCommitted = 0;
    let queued = 0;
    let rejected = 0;

    const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    for (const event of extracted.events) {
      const confidence = event.confidence_score ?? 0.9;
      const decision = classifyConfidence(confidence);

      const payload = {
        event_type: event.event_type,
        identifiers: extracted.identifiers,
        profile_data: extracted.profile_data,
        confidence_score: confidence,
        properties: event.properties,
        ...(event.product && { product: event.product }),
        ...(event.payment && { payment: event.payment }),
        ...(event.policy && { policy: event.policy }),
        ...(event.agent && { agent: event.agent }),
        ...(event.visit && { visit: event.visit }),
        ...(event.diagnosis && { diagnosis: event.diagnosis }),
        ...(event.treatment && { treatment: event.treatment }),
        ...(event.provider && { provider: event.provider }),
        ...(event.protocol && { protocol: event.protocol }),
        source: "voice_stt",
        call_id: parsed.data.call_id,
        _vertical: session.vertical,
        _source: "transcript",
      };

      if (decision === "reject") {
        rejected++;
        continue;
      }

      if (decision === "review") {
        enqueueForReview({
          tenantId: session.tenantId,
          source: "transcript",
          confidence_score: confidence,
          event_type: event.event_type,
          identifiers: extracted.identifiers,
          profile_data: extracted.profile_data,
          payload,
          reason: `Confidence ${Math.round(confidence * 100)}% requires human review`,
        });
        queued++;
        continue;
      }

      // auto_commit
      if (isStreamsConfigured()) {
        await produceToStream(session.tenantId, payload);
      } else {
        await fetch(`${baseUrl}/api/events/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-org-id": session.orgId },
          body: JSON.stringify({ events: [payload] }),
        }).catch(() => {});
      }
      autoCommitted++;
    }

    // Commitments always go through (they're metadata, not PHI-sensitive)
    for (const commitment of extracted.commitments) {
      const commitPayload = {
        event_type: "commitment_made",
        identifiers: extracted.identifiers,
        properties: commitment,
        source: "voice_stt",
        call_id: parsed.data.call_id,
        _vertical: session.vertical,
        confidence_score: commitment.confidence_score || 0.9,
      };
      if (isStreamsConfigured()) {
        await produceToStream(session.tenantId, commitPayload);
      } else {
        await fetch(`${baseUrl}/api/events/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-org-id": session.orgId },
          body: JSON.stringify({ events: [commitPayload] }),
        }).catch(() => {});
      }
    }

    auditLog({
      tenant_id: session.tenantId,
      action: "event_ingested",
      actor: "voice_stt",
      resource_type: "Transcript",
      resource_id: parsed.data.call_id || "unknown",
      metadata: { tier, autoCommitted, queued, rejected, commitments: extracted.commitments.length },
    });

    return NextResponse.json(
      {
        accepted: true,
        call_id: parsed.data.call_id,
        extraction_tier: tier,
        events_extracted: extracted.events.length,
        events_auto_committed: autoCommitted,
        events_queued_for_review: queued,
        events_rejected: rejected,
        commitments_extracted: extracted.commitments.length,
        sentiment: extracted.sentiment,
      },
      { status: 202 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
