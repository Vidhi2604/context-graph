import { z } from "zod";

// ── Connector Config ───────────────────────────────────────────────

export const ConnectorTypeSchema = z.enum(["hubspot", "zendesk", "nurix", "salesforce", "zoho"]);
export type ConnectorType = z.infer<typeof ConnectorTypeSchema>;

export interface ConnectorConfig {
  id: string;
  type: ConnectorType;
  tenantId: string;
  name: string;
  credentials: Record<string, string>; // stored in memory (hackathon), encrypted in prod
  active: boolean;
  created_at: string;
}

// ── Standardised event that adapters produce ──────────────────────

export interface ContextMeshEvent {
  event_type: string;
  identifiers: Record<string, string>;      // email, phone, crm_id, ticket_id, etc.
  profile_data?: Record<string, unknown>;   // name, tier, city, etc.
  timestamp?: string;
  confidence_score?: number;
  source?: string;                          // "hubspot" | "zendesk" | "nurix"
  source_id?: string;                       // native object ID (for idempotency)
  properties?: Record<string, unknown>;
  product?: Record<string, unknown>;
  payment?: Record<string, unknown>;
  policy?: Record<string, unknown>;
  agent?: Record<string, unknown>;
  visit?: Record<string, unknown>;
  diagnosis?: Record<string, unknown>;
  treatment?: Record<string, unknown>;
  provider?: Record<string, unknown>;
  protocol?: Record<string, unknown>;
  medications?: Record<string, unknown>[];
  insurance_claim?: Record<string, unknown>;
}

// ── Adapter interface ─────────────────────────────────────────────

export interface ConnectorAdapter {
  type: ConnectorType;

  /** Map incoming webhook payload to ContextMeshEvents */
  mapWebhook(payload: Record<string, unknown>): ContextMeshEvent[];

  /** Pull records since a given timestamp (pull mode) */
  sync(
    credentials: Record<string, string>,
    since?: string
  ): Promise<ContextMeshEvent[]>;

  /** Test that credentials are valid */
  testConnection(credentials: Record<string, string>): Promise<{ ok: boolean; detail?: string }>;
}

// ── Sync result ───────────────────────────────────────────────────

export interface SyncResult {
  connector_type: ConnectorType;
  events_synced: number;
  events_failed: number;
  started_at: string;
  completed_at: string;
}
