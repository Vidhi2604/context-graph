/**
 * ContextMesh JavaScript / TypeScript SDK
 *
 * Usage:
 *   import { ContextMesh } from "@contextmesh/sdk";
 *   const cm = new ContextMesh({ apiKey: "cm_live_...", baseUrl: "https://your-deployment.com" });
 *   await cm.track({ userId: "u_123", event: "purchase", properties: { amount: 1499 } });
 */

export interface ContextMeshOptions {
  apiKey: string;
  baseUrl?: string;
  vertical?: "retail" | "healthcare";
  debug?: boolean;
}

export interface TrackOptions {
  userId?: string;
  email?: string;
  phone?: string;
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

export interface SearchOptions {
  query: string;
  vertical?: string;
  limit?: number;
}

export interface AgentContextOptions {
  email?: string;
  phone?: string;
  userId?: string;
  include?: ("profile" | "events" | "insights" | "alerts")[];
}

export class ContextMesh {
  private baseUrl: string;
  private headers: Record<string, string>;
  private debug: boolean;

  constructor(options: ContextMeshOptions) {
    this.baseUrl = (options.baseUrl || "http://localhost:3000").replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    };
    this.debug = options.debug || false;
  }

  // ── Event Tracking ──────────────────────────────────────────────

  async track(opts: TrackOptions): Promise<{ ok: boolean; event_id?: string }> {
    const body = {
      event_type: opts.event,
      identifiers: {
        ...(opts.userId ? { user_id: opts.userId } : {}),
        ...(opts.email ? { email: opts.email } : {}),
        ...(opts.phone ? { phone: opts.phone } : {}),
      },
      timestamp: opts.timestamp || new Date().toISOString(),
      properties: opts.properties || {},
    };

    return this._post("/api/events", body);
  }

  async trackBatch(events: TrackOptions[]): Promise<{ ok: boolean; ingested: number }> {
    const body = {
      events: events.map((e) => ({
        event_type: e.event,
        identifiers: {
          ...(e.userId ? { user_id: e.userId } : {}),
          ...(e.email ? { email: e.email } : {}),
          ...(e.phone ? { phone: e.phone } : {}),
        },
        timestamp: e.timestamp || new Date().toISOString(),
        properties: e.properties || {},
      })),
    };

    return this._post("/api/events/batch", body);
  }

  // ── Raw Ingest (any format) ─────────────────────────────────────

  async ingestRaw(
    data: Record<string, unknown> | Record<string, unknown>[],
    clientKey?: string
  ): Promise<{ ok: boolean; mapped: number }> {
    const url = clientKey ? `/api/ingest/raw?client=${clientKey}` : "/api/ingest/raw";
    return this._post(url, data);
  }

  // ── Search & Graph ──────────────────────────────────────────────

  async search(opts: SearchOptions): Promise<{
    nodes: unknown[];
    edges: unknown[];
    insights?: string;
  }> {
    return this._post("/api/search", opts);
  }

  // ── Agent Context ───────────────────────────────────────────────

  async getAgentContext(opts: AgentContextOptions): Promise<{
    profile: unknown;
    recent_events: unknown[];
    insights: string;
    alerts: unknown[];
    context_summary: string;
  }> {
    return this._post("/api/agent/context", opts);
  }

  // ── Profiles ────────────────────────────────────────────────────

  async getProfile(profileId: string): Promise<unknown> {
    return this._get(`/api/profiles/${profileId}`);
  }

  // ── Stats ───────────────────────────────────────────────────────

  async getStats(): Promise<unknown> {
    return this._get("/api/stats");
  }

  // ── Connectors ──────────────────────────────────────────────────

  async syncConnector(connectorId: string, since?: string): Promise<unknown> {
    return this._post("/api/connectors/sync", { connector_id: connectorId, since });
  }

  // ── Internal ────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _post(path: string, body: unknown): Promise<any> {
    if (this.debug) console.log(`[ContextMesh] POST ${path}`, body);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ContextMesh API error ${res.status}: ${err}`);
    }
    return res.json();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _get(path: string): Promise<any> {
    if (this.debug) console.log(`[ContextMesh] GET ${path}`);
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ContextMesh API error ${res.status}: ${err}`);
    }
    return res.json();
  }
}

// ── Browser auto-capture (optional) ────────────────────────────────

export class ContextMeshBrowser extends ContextMesh {
  private sessionId: string;

  constructor(options: ContextMeshOptions) {
    super(options);
    this.sessionId = this._generateSessionId();
    if (typeof window !== "undefined") {
      this._attachAutoCapture();
    }
  }

  private _generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private _attachAutoCapture(): void {
    // Page view on load
    window.addEventListener("load", () => {
      this.track({
        event: "page_view",
        properties: {
          url: window.location.href,
          referrer: document.referrer,
          session_id: this.sessionId,
        },
      }).catch(() => {});
    });

    // Page view on SPA navigation
    const originalPushState = history.pushState.bind(history);
    history.pushState = (...args) => {
      originalPushState(...args);
      this.track({
        event: "page_view",
        properties: {
          url: window.location.href,
          session_id: this.sessionId,
        },
      }).catch(() => {});
    };
  }

  identify(identifiers: { email?: string; phone?: string; userId?: string }): void {
    this.track({
      event: "identify",
      ...identifiers,
      properties: { session_id: this.sessionId },
    }).catch(() => {});
  }
}

export default ContextMesh;
