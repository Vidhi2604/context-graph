import { v4 as uuidv4 } from "uuid";

// Check if Kafka is configured — used to skip Kafka calls gracefully
export function isKafkaConfigured(): boolean {
  return !!(
    process.env.UPSTASH_KAFKA_REST_URL &&
    process.env.UPSTASH_KAFKA_REST_USERNAME &&
    process.env.UPSTASH_KAFKA_REST_PASSWORD
  );
}

// Lazy-loaded — only instantiated when Kafka is configured
async function getKafka() {
  if (!isKafkaConfigured()) {
    throw new Error("Kafka not configured — set UPSTASH_KAFKA_REST_URL, USERNAME, PASSWORD");
  }
  const { Kafka } = await import("@upstash/kafka");
  return new Kafka({
    url: process.env.UPSTASH_KAFKA_REST_URL!,
    username: process.env.UPSTASH_KAFKA_REST_USERNAME!,
    password: process.env.UPSTASH_KAFKA_REST_PASSWORD!,
  });
}

function makeIdempotencyKey(
  tenantId: string,
  event: Record<string, unknown>
): string {
  const sourceId = event.source_id || event.call_id || uuidv4();
  return `${tenantId}:${event.event_type ?? "unknown"}:${sourceId}`;
}

export async function produceEvent(
  tenantId: string,
  event: Record<string, unknown>
): Promise<void> {
  const k = await getKafka();
  const p = k.producer();
  await p.produce(
    `events-${tenantId}`,
    JSON.stringify({
      ...event,
      _tenant: tenantId,
      _produced_at: new Date().toISOString(),
      _idempotency_key: (event._idempotency_key as string) || makeIdempotencyKey(tenantId, event),
    })
  );
}

export async function produceBatch(
  tenantId: string,
  events: Record<string, unknown>[]
): Promise<void> {
  const k = await getKafka();
  const p = k.producer();
  const messages = events.map((e) => ({
    topic: `events-${tenantId}`,
    value: JSON.stringify({
      ...e,
      _tenant: tenantId,
      _produced_at: new Date().toISOString(),
      _idempotency_key: (e._idempotency_key as string) || makeIdempotencyKey(tenantId, e),
    }),
  }));
  await p.produceMany(messages);
}

export async function consumeEvents(
  tenantId: string
): Promise<Record<string, unknown>[]> {
  const k = await getKafka();
  const c = k.consumer();
  const messages = await c.consume({
    consumerGroupId: `contextmesh-${tenantId}`,
    instanceId: `processor-${tenantId}`,
    topics: [`events-${tenantId}`],
    autoOffsetReset: "earliest",
  });
  // Guard JSON.parse — malformed messages return _raw sentinel
  return messages.map((m) => {
    try {
      const parsed = JSON.parse(m.value as string);
      if (typeof parsed !== "object" || parsed === null) {
        return { _raw: m.value, _parse_error: "not an object" };
      }
      return parsed as Record<string, unknown>;
    } catch {
      return { _raw: m.value, _parse_error: "invalid JSON" };
    }
  });
}
