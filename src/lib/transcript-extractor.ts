import { generateJSON } from "./groq";
import { TranscriptInput } from "@/types/event";

interface ExtractedData {
  identifiers: Record<string, string>;
  profile_data: Record<string, unknown>;
  events: {
    event_type: string;
    confidence_score: number;
    properties: Record<string, unknown>;
    product?: Record<string, unknown>;
    payment?: Record<string, unknown>;
    policy?: Record<string, unknown>;
    agent?: Record<string, unknown>;
    visit?: Record<string, unknown>;
    diagnosis?: Record<string, unknown>;
    treatment?: Record<string, unknown>;
    provider?: Record<string, unknown>;
    protocol?: Record<string, unknown>;
  }[];
  commitments: {
    promise_text: string;
    deadline: string | null;
    assignee: string | null;
    confidence_score: number;
  }[];
  sentiment: {
    trajectory: string;
    score: number;
  };
}

export async function extractFromTranscript(
  transcript: TranscriptInput,
  vertical: string
): Promise<ExtractedData> {
  const transcriptText = transcript.transcript
    .filter((t) => t && t.speaker && t.text) // null safety
    .map((t) => `${t.speaker}: ${t.text}`)
    .join("\n");

  if (!transcriptText) {
    return { identifiers: {}, profile_data: {}, events: [], commitments: [], sentiment: { trajectory: "unknown", score: 0.5 } };
  }

  const participantInfo = transcript.participants
    ?.filter((p) => p && p.role)
    ?.map((p) => `${p.role}: ${p.name || "unknown"} ${p.phone ? `(${p.phone})` : ""} ${p.agent_id ? `[${p.agent_id}]` : ""}`)
    .join(", ") || "";

  const prompt = vertical === "retail" ? RETAIL_PROMPT : HEALTHCARE_PROMPT;

  const result = await generateJSON<ExtractedData>(
    prompt,
    `PARTICIPANTS: ${participantInfo}\n\nTRANSCRIPT:\n${transcriptText}`
  );

  // Ensure confidence scores default to 0.7 if omitted
  for (const event of result.events) {
    event.confidence_score = event.confidence_score ?? 0.7;
  }
  for (const commitment of result.commitments) {
    commitment.confidence_score = commitment.confidence_score ?? 0.7;
  }

  return result;
}

const RETAIL_PROMPT = `You are analyzing a customer support call transcript for a retail company.

Extract ALL of the following into a JSON object:

1. "identifiers": { phone, email, name, order_id — anything identifying the customer }
2. "profile_data": { tier, city — if mentioned }
3. "events": array of events, each with:
   - event_type (support_call, return_initiated, complaint, purchase, etc.)
   - confidence_score: 0.0 to 1.0 (0.9+ if explicit, 0.7-0.9 if implied, 0.5-0.7 if inferred, <0.5 if a guess)
   - properties: event-specific data
   - product, payment, policy, agent objects if relevant
4. "commitments": array of promises with: promise_text, deadline (ISO date or null), assignee, confidence_score
5. "sentiment": { trajectory: "frustrated → resolved", score: 0.0-1.0 }

Return valid JSON only.`;

const HEALTHCARE_PROMPT = `You are analyzing a clinical transcript (doctor dictation / patient call).

Extract ALL of the following into a JSON object:

1. "identifiers": { mrn, phone, name, aadhaar — anything identifying the patient }
2. "profile_data": { age, gender, blood_group, city, insurance_provider — if mentioned }
3. "events": array of clinical events, each with:
   - event_type (visit, diagnosis, treatment, medication_prescribed, discharge, etc.)
   - confidence_score: 0.0 to 1.0 (0.9+ if explicit, 0.7-0.9 if implied, 0.5-0.7 if inferred, <0.5 if a guess)
   - visit, diagnosis, treatment, provider, protocol objects if relevant
4. "commitments": array with: promise_text, deadline (ISO date or null), assignee, confidence_score
5. "sentiment": { trajectory: "stable" or "concerned → reassured", score: 0.0-1.0 }

Return valid JSON only.`;
