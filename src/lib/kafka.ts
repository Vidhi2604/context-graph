import { Kafka } from "@upstash/kafka";
import { v4 as uuidv4 } from "uuid";

let kafka: Kafka | null = null;

function getKafka(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      url: process.env.UPSTASH_KAFKA_REST_URL!,
      username: process.env.UPSTASH_KAFKA_REST_USERNAME!,
      password: process.env.UPSTASH_KAFKA_REST_PASSWORD!,
    });
  }
  return kafka;
}

function makeIdempotencyKey(
  tenantId: string,
  event: Record<string, unknown>
): string {
  // Deterministic for retries, unique per event
  const sourceId = event.source_id || event.call_id || uuidv4();
  return `${tenantId}:${event.event_type}:${sourceId}`;
}

export async function produceEvent(
  tenantId: string,
  event: Record<string, unknown>
): Promise<void> {
  const p = getKafka().producer();
  await p.produce(`events-${tenantId}`, JSON.stringify({
    ...event,
    _tenant: tenantId,
    _produced_at: new Date().toISOString(),
    _idempotency_key: (event._idempotency_key as string) || makeIdempotencyKey(tenantId, event),
  }));
}

export async function produceBatch(
  tenantId: string,
  events: Record<string, unknown>[]
): Promise<void> {
  const p = getKafka().producer();
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
  const c = getKafka().consumer();
  const messages = await c.consume({
    consumerGroupId: `contextmesh-${tenantId}`,
    instanceId: `processor-${tenantId}`,
    topics: [`events-${tenantId}`],
    autoOffsetReset: "earliest",
  });
  return messages.map((m) => {
    try {
      return JSON.parse(m.value as string);
    } catch {
      return { _raw: m.value };
    }
  });
}
