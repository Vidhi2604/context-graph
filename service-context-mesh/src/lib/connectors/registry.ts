import { ConnectorAdapter, ConnectorConfig, ConnectorType } from "@/types/connector";
import { HubSpotAdapter } from "./hubspot";
import { ZendeskAdapter } from "./zendesk";
import { NurixAdapter } from "./nurix";
import { SalesforceAdapter } from "./salesforce";
import { ZohoAdapter } from "./zoho";
import { MCPAdapter } from "./mcp";
import { prisma } from "@/lib/prisma";

// ── Adapter registry ──────────────────────────────────────────────

const ADAPTERS: Record<ConnectorType, ConnectorAdapter> = {
  hubspot: HubSpotAdapter,
  zendesk: ZendeskAdapter,
  nurix: NurixAdapter,
  salesforce: SalesforceAdapter as unknown as ConnectorAdapter,
  zoho: ZohoAdapter as unknown as ConnectorAdapter,
  mcp: MCPAdapter,
};

export function getAdapter(type: ConnectorType): ConnectorAdapter {
  const adapter = ADAPTERS[type];
  if (!adapter) throw new Error(`Unknown connector type: ${type}`);
  return adapter;
}

// ── DB-backed connector store ─────────────────────────────────────

export async function getConnectors(tenantId: string): Promise<ConnectorConfig[]> {
  const rows = await prisma.connector.findMany({ where: { tenantId } });
  return rows.map(r => ({
    id: r.id,
    type: r.type as ConnectorType,
    tenantId: r.tenantId,
    name: r.name,
    active: r.active,
    created_at: r.createdAt.toISOString(),
    credentials: JSON.parse(r.credentials || "{}"),
  }));
}

export async function saveConnector(config: ConnectorConfig): Promise<void> {
  const { id, type, tenantId, name, active, created_at, ...rest } = config;
  const credentials = JSON.stringify(rest.credentials || {});

  await prisma.connector.upsert({
    where: { id: id || "new" },
    update: { name, active: active ?? true, credentials, updatedAt: new Date() },
    create: { id, type, tenantId, name, active: active ?? true, credentials },
  });
}

export async function deleteConnector(tenantId: string, connectorId: string): Promise<boolean> {
  try {
    await prisma.connector.delete({ where: { id: connectorId, tenantId } });
    return true;
  } catch {
    return false;
  }
}

export async function getConnector(tenantId: string, connectorId: string): Promise<ConnectorConfig | null> {
  const row = await prisma.connector.findFirst({ where: { id: connectorId, tenantId } });
  if (!row) return null;
  return {
    id: row.id,
    type: row.type as ConnectorType,
    tenantId: row.tenantId,
    name: row.name,
    active: row.active,
    created_at: row.createdAt.toISOString(),
    credentials: JSON.parse(row.credentials || "{}"),
  };
}

// ── Mask credentials for API responses ───────────────────────────

export function maskConfig(config: ConnectorConfig): ConnectorConfig {
  const masked = { ...config };
  masked.credentials = Object.fromEntries(
    Object.entries(config.credentials).map(([k, v]) => [
      k,
      String(v).length > 8
        ? `${String(v).slice(0, 4)}${"*".repeat(String(v).length - 8)}${String(v).slice(-4)}`
        : "****",
    ])
  );
  return masked;
}
