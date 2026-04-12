import { getConnectors } from "@/lib/connectors/registry";
import { getAdapter } from "@/lib/connectors/registry";
import { processEventsBatch } from "@/lib/process-events";
import { logActivity, completeActivity } from "@/lib/activity-log";
import type { ContextMeshEvent } from "@/types/connector";

const LIVE_SEARCH_CONNECTORS = ["hubspot", "zendesk", "nurix"] as const;
const TIMEOUT_MS = 5000;

/**
 * Fire-and-forget live search across connected CRMs.
 * Fetches matching records in parallel, ingests new ones into Neo4j.
 * Never throws — all errors are swallowed to avoid blocking search.
 */
export async function triggerLiveSearch(
  query: string,
  tenantId: string,
  orgId: string,
  vertical: string
): Promise<void> {
  try {
    const connectors = await getConnectors(tenantId);
    const active = connectors.filter(
      c => c.active && (LIVE_SEARCH_CONNECTORS as readonly string[]).includes(c.type)
    );
    if (!active.length) return;

    await Promise.allSettled(
      active.map(async (connector) => {
        const actId = logActivity(tenantId, {
          layer: "ingest",
          label: `Live Search → ${connector.name || connector.type}`,
          detail: `query: "${query}"`,
          status: "running",
          started_at: Date.now(),
        });

        try {
          const adapter = getAdapter(connector.type);
          if (!adapter.liveSearch) {
            completeActivity(tenantId, actId, "skipped", "live search not supported");
            return;
          }

          // Race against timeout
          const events: ContextMeshEvent[] = await Promise.race([
            adapter.liveSearch(query, connector.credentials),
            new Promise<ContextMeshEvent[]>((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
            ),
          ]);

          if (!events.length) {
            completeActivity(tenantId, actId, "success", "no new records found");
            return;
          }

          // Tag events with ingest source and vertical
          const tagged = events.map(e => ({
            ...e,
            _ingest_source: connector.type,
            _vertical: vertical,
          }));

          const result = await processEventsBatch(tagged, tenantId, orgId);
          completeActivity(tenantId, actId, "success",
            `${result.processed} ingested · ${result.failed} failed`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "failed";
          completeActivity(tenantId, actId, msg === "timeout" ? "error" : "error",
            msg === "timeout" ? "timed out after 5s" : msg
          );
        }
      })
    );
  } catch { /* never throw from live search */ }
}
