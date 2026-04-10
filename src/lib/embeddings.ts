/**
 * embeddings.ts — Journey embedding generation using @xenova/transformers
 *
 * Model: Xenova/all-MiniLM-L6-v2
 *   - 384-dimensional embeddings
 *   - ~23MB model weights, downloaded once and cached on disk
 *   - Runs entirely in the Node.js process — no external API call, no cost
 *
 * Embeddings are stored on Profile nodes in Neo4j and used for vector
 * similarity search via the native Neo4j vector index (§14 / §8).
 */


import { pipeline } from "@xenova/transformers";
import { runQuery } from "./neo4j";

// ─── Singleton pipeline ───────────────────────────────────────────────────────

// Created once per process lifecycle. First call downloads ~23 MB of model
// weights from Hugging Face and caches them. Subsequent calls: instant.
let _embedder: ReturnType<typeof pipeline> extends Promise<infer T>
  ? T | null
  : unknown = null;

async function getEmbedder() {
  if (!_embedder) {
    _embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return _embedder;
}

// ─── Journey serialisation ────────────────────────────────────────────────────

// Fields that carry no semantic signal for similarity matching — excluded from
// the serialised text so that embeddings represent behaviour, not metadata.
const SKIP_FIELDS = new Set([
  "_tenant",
  "_vertical",
  "id",
  "timestamp",
  "event_type",
  "type",
  "confidence_score",
]);

/**
 * serializeJourney — deterministic text representation of a profile's event
 * history. Events are sorted by timestamp ascending so that the same journey
 * always produces the same text string and therefore the same embedding vector.
 *
 * Output format:
 *   "[purchase] tier:Gold, product:Nike Air Max → [return_initiated] reason:size_issue"
 */
export function serializeJourney(
  events: Array<{
    e: Record<string, unknown>;
    detail: Record<string, unknown> | null;
  }>
): string {
  if (!events.length) return "No events recorded.";

  // Sort by timestamp ascending (Cypher should already order these, but enforce
  // determinism here so results are consistent regardless of query ordering).
  const sorted = [...events].sort((a, b) =>
    String(a.e.timestamp ?? "").localeCompare(String(b.e.timestamp ?? ""))
  );

  const lines = sorted.map(({ e, detail }) => {
    const type = String(e.event_type ?? e.type ?? "unknown");

    const props = Object.entries(e)
      .filter(([k, v]) => !SKIP_FIELDS.has(k) && v != null && v !== "")
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");

    const detailStr = detail
      ? ` [${Object.entries(detail)
          .filter(([k]) => !SKIP_FIELDS.has(k))
          .map(([k, v]) => `${k}:${v}`)
          .join(",")}]`
      : "";

    return `[${type}]${props ? ` ${props}` : ""}${detailStr}`;
  });

  return lines.join(" → ");
}

// ─── Core embedding generation ────────────────────────────────────────────────

/**
 * generateJourneyEmbedding — fetches a profile's events from Neo4j, serialises
 * them deterministically, generates a 384-dim embedding via the local model,
 * and stores it on the Profile node.
 *
 * The stored embedding powers:
 *   - POST /api/search/similar (vector similarity search)
 *   - Agent context: "similar cases" section
 */
export async function generateJourneyEmbedding(
  profileId: string,
  tenantId: string
): Promise<number[]> {
  // 1. Fetch the profile's full event history
  const events = await runQuery<{
    e: Record<string, unknown>;
    detail: Record<string, unknown> | null;
  }>(
    `
    MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
          -[:PERFORMED|HAD_VISIT]->(e)
    OPTIONAL MATCH (e)-[:INVOLVES|DIAGNOSED_WITH]->(detail)
    RETURN e, detail ORDER BY e.timestamp ASC
    `,
    { profileId, tenantId }
  );

  // 2. Serialise to deterministic text
  const journeyText = serializeJourney(events);

  // 3. Generate embedding locally — no API call, no cost
  const embedder = await getEmbedder();
  const output = await (embedder as (
    text: string,
    opts: { pooling: string; normalize: boolean }
  ) => Promise<{ data: ArrayLike<number> }>)(journeyText, {
    pooling: "mean",
    normalize: true,
  });
  const embedding = Array.from(output.data) as number[];

  // 4. Persist on the Profile node and stamp the update time
  await runQuery(
    `
    MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
    SET p.journey_embedding = $embedding,
        p.embedding_updated_at = datetime()
    `,
    { profileId, tenantId, embedding }
  );

  return embedding;
}

// ─── Debounced update ─────────────────────────────────────────────────────────

/**
 * updateJourneyEmbeddingDebounced — skips regeneration if the embedding was
 * refreshed within the last `minIntervalMs` milliseconds (default: 5 minutes).
 *
 * Called from the Kafka consumer after each event write. The debounce prevents
 * re-embedding a profile on every single message in a burst (e.g. batch ingestion).
 *
 * The debounce check reads `embedding_updated_at` from the Profile node — the
 * same field stamped by generateJourneyEmbedding — so there is no separate
 * state to manage.
 */
export async function updateJourneyEmbeddingDebounced(
  profileId: string,
  tenantId: string,
  minIntervalMs = 5 * 60_000
): Promise<void> {
  // Read the last update timestamp from Neo4j
  const result = await runQuery<{ lastUpdate: string | null }>(
    `
    MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
    RETURN p.embedding_updated_at AS lastUpdate
    `,
    { profileId, tenantId }
  );

  const lastUpdate = result?.[0]?.lastUpdate;

  if (
    lastUpdate &&
    Date.now() - new Date(lastUpdate).getTime() < minIntervalMs
  ) {
    // Embedding is fresh — skip regeneration
    return;
  }

  await generateJourneyEmbedding(profileId, tenantId);
}
