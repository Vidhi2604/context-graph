/**
 * activity-log.ts — Shared in-memory activity log for the debug panel.
 * All routes write here. Frontend polls /api/debug/activity.
 */

export type ActivityLayer =
  | "auth"
  | "ingest"
  | "redis"
  | "process"
  | "llm"
  | "neo4j"
  | "mapping"
  | "scoring"
  | "insight";

export type ActivityStatus = "running" | "success" | "error" | "skipped";

export interface ActivityEntry {
  id: string;
  tenant_id: string;
  layer: ActivityLayer;
  label: string;
  detail?: string;
  status: ActivityStatus;
  started_at: number;   // ms since epoch
  ended_at?: number;
  duration_ms?: number;
  group_id?: string;    // groups parallel steps (e.g. same ingest batch)
  metadata?: Record<string, unknown>; // structured debug data shown in expanded view
}

// Circular buffer — keep last 200 entries per tenant
const MAX = 200;
const store = new Map<string, ActivityEntry[]>();

let seq = 0;

export function logActivity(
  tenantId: string,
  entry: Omit<ActivityEntry, "id" | "tenant_id">
): string {
  const id = `act_${Date.now()}_${++seq}`;
  const full: ActivityEntry = { id, tenant_id: tenantId, ...entry };

  if (!store.has(tenantId)) store.set(tenantId, []);
  const list = store.get(tenantId)!;
  list.push(full);
  if (list.length > MAX) list.splice(0, list.length - MAX);

  return id;
}

export function completeActivity(
  tenantId: string,
  id: string,
  status: ActivityStatus,
  detail?: string,
  metadata?: Record<string, unknown>
) {
  const list = store.get(tenantId);
  if (!list) return;
  const entry = list.find(e => e.id === id);
  if (!entry) return;
  entry.ended_at = Date.now();
  entry.duration_ms = entry.ended_at - entry.started_at;
  entry.status = status;
  if (detail) entry.detail = detail;
  if (metadata) entry.metadata = { ...entry.metadata, ...metadata };
}

export function getActivity(tenantId: string, since?: number): ActivityEntry[] {
  const list = store.get(tenantId) || [];
  if (since) return list.filter(e => e.started_at > since);
  return [...list];
}
