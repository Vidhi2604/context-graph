/**
 * Audit Log — SOX / HIPAA compliant event trail
 *
 * Every write operation (event ingest, profile update, identity merge,
 * policy override, commitment creation) is logged here.
 *
 * Production: write to append-only Postgres table with immutable rows.
 * Hackathon: in-memory ring buffer (last 10K entries per tenant).
 */

export type AuditAction =
  | "event_ingested"
  | "profile_created"
  | "profile_merged"
  | "identity_resolved"
  | "commitment_created"
  | "commitment_breached"
  | "policy_override"
  | "review_approved"
  | "review_rejected"
  | "phi_accessed"
  | "export_requested"
  | "connector_synced"
  | "alert_triggered";

export interface AuditEntry {
  id: string;
  tenant_id: string;
  action: AuditAction;
  actor: string;          // user_id or "system" or "api_key:xxxx"
  resource_type: string;  // Profile | Event | Commitment | Policy
  resource_id: string;
  metadata: Record<string, unknown>;
  ip?: string;
  timestamp: string;
}

// In-memory ring buffer per tenant (max 10K entries)
const logs = new Map<string, AuditEntry[]>();
const MAX_ENTRIES = 10_000;

export function auditLog(entry: Omit<AuditEntry, "id" | "timestamp">): void {
  const id = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: AuditEntry = {
    ...entry,
    id,
    timestamp: new Date().toISOString(),
  };

  const existing = logs.get(entry.tenant_id) || [];
  existing.push(record);

  // Ring buffer — drop oldest if over limit
  if (existing.length > MAX_ENTRIES) existing.splice(0, existing.length - MAX_ENTRIES);
  logs.set(entry.tenant_id, existing);
}

export function getAuditLog(
  tenantId: string,
  opts: {
    action?: AuditAction;
    resource_type?: string;
    resource_id?: string;
    from?: string;
    to?: string;
    limit?: number;
  } = {}
): AuditEntry[] {
  let entries = logs.get(tenantId) || [];

  if (opts.action) entries = entries.filter((e) => e.action === opts.action);
  if (opts.resource_type) entries = entries.filter((e) => e.resource_type === opts.resource_type);
  if (opts.resource_id) entries = entries.filter((e) => e.resource_id === opts.resource_id);
  if (opts.from) entries = entries.filter((e) => e.timestamp >= opts.from!);
  if (opts.to) entries = entries.filter((e) => e.timestamp <= opts.to!);

  return entries
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, opts.limit || 500);
}

export function exportAuditCSV(entries: AuditEntry[]): string {
  const header = "id,timestamp,tenant_id,action,actor,resource_type,resource_id,metadata";
  const rows = entries.map((e) =>
    [
      e.id,
      e.timestamp,
      e.tenant_id,
      e.action,
      e.actor,
      e.resource_type,
      e.resource_id,
      JSON.stringify(e.metadata).replace(/"/g, '""'),
    ]
      .map((v) => `"${v}"`)
      .join(",")
  );
  return [header, ...rows].join("\n");
}
