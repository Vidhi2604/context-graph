/**
 * lib/llm.ts — Anthropic Claude only
 *
 * claudeExtract → Claude Haiku (fast, structured JSON)
 * claudeReason  → Claude Sonnet (deep reasoning)
 *
 * No Groq. No rate limit issues.
 */

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY,
    });
  }
  return _client;
}

const EXTRACT_MODEL = "claude-haiku-4-5-20251001";
const REASON_MODEL  = "claude-sonnet-4-6";

// ── LRU Cache ────────────────────────────────────────────────────────

interface CacheEntry { value: unknown; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX    = 500;

function cacheKey(system: string, user: string): string {
  return `${system.slice(0, 120)}|||${user.slice(0, 120)}`;
}
function cacheGet(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.value;
}
function cacheSet(key: string, value: unknown): void {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function getCacheStats() {
  return { size: cache.size, max: CACHE_MAX };
}

function parseJSON(text: string): unknown {
  try { return JSON.parse(text); } catch {}
  // Strip markdown fences
  const clean = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  try { return JSON.parse(clean); } catch {}
  // Extract first JSON object
  const match = text.match(/\{[\s\S]+\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  return {};
}

// ── claudeExtract ────────────────────────────────────────────────────

export async function claudeExtract(
  userPrompt: string,
  systemPrompt: string
): Promise<unknown> {
  const key = cacheKey(systemPrompt, userPrompt);
  const hit = cacheGet(key);
  if (hit !== null) return hit;

  try {
    const res = await getClient().messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 2048,
      system: systemPrompt + "\n\nRespond with valid JSON only. No markdown, no explanation.",
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    const parsed = parseJSON(text);

    if (parsed && typeof parsed === "object" && Object.keys(parsed as object).length > 0) {
      cacheSet(key, parsed);
    }
    return parsed;
  } catch (err) {
    console.error("[llm] claudeExtract:", err instanceof Error ? err.message : err);
    return {};
  }
}

// ── claudeReason ─────────────────────────────────────────────────────

export async function claudeReason(
  userPrompt: string,
  systemPrompt: string
): Promise<string> {
  const key = cacheKey(systemPrompt, userPrompt);
  const hit = cacheGet(key);
  if (hit !== null) return String(hit);

  try {
    const res = await getClient().messages.create({
      model: REASON_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    if (text) cacheSet(key, text);
    return text;
  } catch (err) {
    console.error("[llm] claudeReason:", err instanceof Error ? err.message : err);
    return "";
  }
}
