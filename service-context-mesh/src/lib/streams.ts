/**
 * streams.ts — Redis Streams pipeline (replaces Kafka)
 *
 * Uses Upstash Redis Streams for async event processing.
 * XADD to produce, XREAD to consume (simple mode without consumer groups
 * to avoid Upstash client API differences).
 *
 * Stream key format: "stream:{tenantId}"
 */

import { Redis } from "@upstash/redis";
import { v4 as uuidv4 } from "uuid";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error("Redis Streams not configured");
    }
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export function isStreamsConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function streamKey(tenantId: string): string {
  return `stream:${tenantId}`;
}

function makeIdempotencyKey(tenantId: string, event: Record<string, unknown>): string {
  const sourceId = event.source_id || event.call_id || uuidv4();
  return `${tenantId}:${event.event_type ?? "unknown"}:${sourceId}`;
}

// Track last read ID per tenant (in-memory, resets on restart)
const lastReadIds: Record<string, string> = {};

/**
 * Produce a single event to the Redis Stream via XADD.
 */
export async function produceToStream(
  tenantId: string,
  event: Record<string, unknown>
): Promise<string> {
  const r = getRedis();
  const key = streamKey(tenantId);

  const payload = JSON.stringify({
    ...event,
    _tenant: tenantId,
    _produced_at: new Date().toISOString(),
    _idempotency_key: (event._idempotency_key as string) || makeIdempotencyKey(tenantId, event),
  });

  // XADD key * data payload
  const messageId = await r.xadd(key, "*", { data: payload });
  return String(messageId);
}

/**
 * Produce a batch of events.
 */
export async function produceBatchToStream(
  tenantId: string,
  events: Record<string, unknown>[]
): Promise<string[]> {
  const ids: string[] = [];
  for (const event of events) {
    const id = await produceToStream(tenantId, event);
    ids.push(id);
  }
  return ids;
}

/**
 * Consume events from the Redis Stream via XREAD.
 * Reads new messages since last consumed ID.
 */
export async function consumeFromStream(
  tenantId: string,
  count = 50
): Promise<Record<string, unknown>[]> {
  const r = getRedis();
  const key = streamKey(tenantId);
  const lastId = lastReadIds[tenantId] || "0-0";

  // XREAD COUNT count STREAMS key lastId
  // Upstash xread: (key, id, options) OR (keys[], ids[], options)
  const result = await r.xread(key, lastId, { count });

  if (!result || result.length === 0) return [];

  const events: Record<string, unknown>[] = [];

  // Upstash xread format: [[key, [[id, ["data", {object}]], ...]]]
  const streamData = (result as unknown[][])[0];
  if (!streamData || !Array.isArray(streamData[1])) return [];

  const msgList = streamData[1] as unknown[][];
  for (const entry of msgList) {
    try {
      const msgId = (entry as unknown[])[0] as string;
      const fields = (entry as unknown[])[1] as unknown[];
      // fields = ["data", {event object}]
      const dataIdx = (fields as unknown[]).indexOf("data");
      const raw = dataIdx !== -1 ? fields[dataIdx + 1] : null;
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) as Record<string, unknown> : raw as Record<string, unknown>;
        events.push({ ...parsed, _stream_id: msgId });
        lastReadIds[tenantId] = msgId;
      } else if (msgId) {
        lastReadIds[tenantId] = msgId;
      }
    } catch {
      // skip bad message
    }
  }

  return events;
}

/**
 * Get stream length for Pipeline Trace display.
 */
export async function getStreamInfo(tenantId: string): Promise<{
  length: number;
  key: string;
  last_id: string;
}> {
  try {
    const r = getRedis();
    const key = streamKey(tenantId);
    const length = await r.xlen(key);
    return {
      length: Number(length),
      key,
      last_id: lastReadIds[tenantId] || "0-0",
    };
  } catch {
    return { length: 0, key: streamKey(tenantId), last_id: "0-0" };
  }
}
