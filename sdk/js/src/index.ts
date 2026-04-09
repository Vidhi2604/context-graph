/**
 * ContextMesh JavaScript/TypeScript SDK
 *
 * Usage:
 *   import { ContextMesh } from "@contextmesh/sdk";
 *   const cm = new ContextMesh({ apiKey: "sk_...", baseUrl: "https://yourapp.com" });
 *   const context = await cm.getContext({ phone: "9876543210" });
 */

export interface ContextMeshOptions {
  apiKey: string;
  baseUrl?: string;
}

export class ContextMesh {
  private apiKey: string;
  private baseUrl: string;

  constructor({ apiKey, baseUrl = "https://contextmesh.app" }: ContextMeshOptions) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async get(path: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`ContextMesh error: ${res.status} ${await res.text()}`);
    return res.json();
  }

  private async post(path: string, body: unknown = {}, trace = false): Promise<unknown> {
    const url = trace ? `${this.baseUrl}${path}?trace=true` : `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`ContextMesh error: ${res.status} ${await res.text()}`);
    return res.json();
  }

  /** Get full pre-conversation brief. Pass any identifier: phone, email, mrn, profile_id */
  getContext(identifiers: Record<string, string>, trace = false) {
    return this.post("/api/agent/context", identifiers, trace);
  }

  /** Natural language search across the context graph */
  search(query: string, limit = 50, trace = false) {
    return this.post("/api/search", { query, limit }, trace);
  }

  /** Get AI insight with reasoning chain */
  analyze(query?: string, nodes?: unknown[], trace = false) {
    return this.post("/api/insights", { query, nodes: nodes || [] }, trace);
  }

  /** Find structurally similar profiles/events */
  findSimilar(nodeId: string, nodeLabel: string, limit = 5) {
    return this.post("/api/search/similar", { node_id: nodeId, node_label: nodeLabel, limit });
  }

  /** Ingest a new event into the context graph */
  track(eventType: string, identifiers: Record<string, string>, properties: Record<string, unknown> = {}) {
    return this.post("/api/events", { event_type: eventType, identifiers, properties });
  }

  /** Ingest multiple events at once (max 1000) */
  trackBatch(events: unknown[]) {
    return this.post("/api/events/batch", { events });
  }

  /** Ingest a call transcript for LLM extraction */
  ingestTranscript(
    transcript: { speaker: string; text: string; start?: number }[],
    options: { participants?: unknown[]; callId?: string; source?: string } = {}
  ) {
    return this.post("/api/events/transcript", {
      transcript,
      participants: options.participants || [],
      call_id: options.callId,
      source: options.source || "voice_stt",
    });
  }

  /** Get active proactive alerts */
  getAlerts() {
    return this.get("/api/alerts");
  }

  /** Get value dashboard stats */
  getStats() {
    return this.get("/api/stats");
  }

  /** Trigger connector sync */
  sync(options: { type?: string; connectorId?: string; since?: string } = {}) {
    return this.post("/api/connectors/sync", {
      type: options.type,
      connector_id: options.connectorId,
      since: options.since,
    });
  }

  /** Explore a node's connections */
  exploreNode(nodeId: string, nodeLabel: string, depth = 2) {
    return this.post("/api/graph/explore", { node_id: nodeId, node_label: nodeLabel, depth });
  }
}

export default ContextMesh;
