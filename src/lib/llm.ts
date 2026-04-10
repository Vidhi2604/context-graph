/**
 * lib/llm.ts — Unified LLM interface
 *
 * Two functions matching main branch's API contract:
 *   - claudeExtract: fast, JSON, high-volume (Cypher gen, extraction, classification)
 *   - claudeReason:  complex reasoning, returns text (insights, summaries, actions)
 *
 * Backed by Groq (free tier, sub-500ms) for hackathon.
 * Production upgrade path: swap getClient() to Anthropic SDK, same call signature.
 */

import Groq from "groq-sdk";

let _client: Groq | null = null;

function getClient(): Groq {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

// Fast model — extraction, classification, Cypher generation
const EXTRACT_MODEL = "llama-3.3-70b-versatile";

// Reasoning model — insights, summaries, agent actions
// Same model on Groq free tier; swap to claude-sonnet-4-6 in production
const REASON_MODEL = "llama-3.3-70b-versatile";

/**
 * claudeExtract — fast structured extraction.
 * Returns parsed JSON. Handles markdown code-fence wrapping.
 */
export async function claudeExtract(
  userPrompt: string,
  systemPrompt: string
): Promise<unknown> {
  const response = await getClient().chat.completions.create({
    model: EXTRACT_MODEL,
    max_tokens: 1024,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content;

  if (!text) {
    console.error("[llm] claudeExtract: empty response from model");
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]+?)```/);
    if (match) {
      try { return JSON.parse(match[1]); } catch {}
    }
    console.error("[llm] claudeExtract: failed to parse JSON from model response");
    return {};
  }
}

/**
 * claudeReason — complex reasoning, returns raw text.
 * Used for: insights narration, pattern summaries, risk explanations, agent actions.
 */
export async function claudeReason(
  userPrompt: string,
  systemPrompt: string
): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: REASON_MODEL,
    max_tokens: 2048,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    console.error("[llm] claudeReason: empty response from model");
    return "";
  }
  return text;
}
