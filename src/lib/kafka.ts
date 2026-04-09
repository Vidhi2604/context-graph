import { Kafka } from "@upstash/kafka";

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

export async function produceEvent(
  tenantId: string,
  event: Record<string, unknown>
): Promise<void> {
  const p = getKafka().producer();
  await p.produce(`events-${tenantId}`, JSON.stringify({
    ...event,
    _tenant: tenantId,
    _produced_at: new Date().toISOString(),
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
