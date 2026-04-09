import { ConnectorAdapter, ConnectorConfig, ConnectorType } from "@/types/connector";
import { HubSpotAdapter } from "./hubspot";
import { ZendeskAdapter } from "./zendesk";
import { NurixAdapter } from "./nurix";

// ── Adapter registry ──────────────────────────────────────────────

const ADAPTERS: Record<ConnectorType, ConnectorAdapter> = {
  hubspot: HubSpotAdapter,
  zendesk: ZendeskAdapter,
  nurix: NurixAdapter,
};

export function getAdapter(type: ConnectorType): ConnectorAdapter {
  const adapter = ADAPTERS[type];
  if (!adapter) throw new Error(`Unknown connector type: ${type}`);
  return adapter;
}

// ── In-memory connector store (hackathon) ─────────────────────────
// Production: Prisma Connector model with encrypted credentials

const connectorStore = new Map<string, ConnectorConfig[]>();

export function getConnectors(tenantId: string): ConnectorConfig[] {
  return connectorStore.get(tenantId) || [];
}

export function saveConnector(config: ConnectorConfig): void {
  const existing = connectorStore.get(config.tenantId) || [];
  const idx = existing.findIndex((c) => c.id === config.id);
  if (idx >= 0) {
    existing[idx] = config;
  } else {
    existing.push(config);
  }
  connectorStore.set(config.tenantId, existing);
}

export function deleteConnector(tenantId: string, connectorId: string): boolean {
  const existing = connectorStore.get(tenantId) || [];
  const filtered = existing.filter((c) => c.id !== connectorId);
  connectorStore.set(tenantId, filtered);
  return filtered.length < existing.length;
}

export function getConnector(tenantId: string, connectorId: string): ConnectorConfig | null {
  return getConnectors(tenantId).find((c) => c.id === connectorId) || null;
}

// ── Mask credentials for API responses ───────────────────────────

export function maskConfig(config: ConnectorConfig): ConnectorConfig {
  const masked = { ...config };
  masked.credentials = Object.fromEntries(
    Object.entries(config.credentials).map(([k, v]) => [
      k,
      v.length > 8 ? `${v.slice(0, 4)}${"*".repeat(v.length - 8)}${v.slice(-4)}` : "****",
    ])
  );
  return masked;
}
