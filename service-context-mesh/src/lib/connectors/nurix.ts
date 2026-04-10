import { ConnectorAdapter, ContextMeshEvent } from "@/types/connector";
import { NURIX_SAMPLE_CALLS } from "@/fixtures/nurix-samples";

export const NurixAdapter: ConnectorAdapter = {
  type: "nurix",

  mapWebhook(payload: Record<string, unknown>): ContextMeshEvent[] {
    // Nurix sends call completion events with transcript + metadata
    const call = payload as {
      call_id?: string;
      caller_phone?: string;
      agent_name?: string;
      agent_id?: string;
      duration_seconds?: number;
      transcript?: string;
      sentiment?: string;
      entities?: {
        customer_name?: string;
        email?: string;
        order_id?: string;
        issue_type?: string;
        resolution?: string;
        promise?: string;
      };
    };

    const phone = call.caller_phone || "";
    const email = call.entities?.email || "";
    const name = call.entities?.customer_name || "";

    return [
      {
        event_type: "support_call",
        identifiers: {
          ...(phone ? { phone } : {}),
          ...(email ? { email } : {}),
          call_id: call.call_id || "",
        },
        profile_data: { ...(name ? { name } : {}) },
        source: "nurix",
        source_id: `nurix_${call.call_id}`,
        confidence_score: 0.9,
        properties: {
          duration_seconds: call.duration_seconds,
          sentiment: call.sentiment,
          issue_type: call.entities?.issue_type,
          resolution: call.entities?.resolution,
          promise: call.entities?.promise,
          transcript_snippet: (call.transcript || "").slice(0, 200),
        },
        agent: call.agent_name
          ? { name: call.agent_name, agent_id: call.agent_id }
          : undefined,
      },
    ];
  },

  async sync(
    credentials: Record<string, string>
  ): Promise<ContextMeshEvent[]> {
    // Hackathon: use sample data. Production: call Nurix API with credentials.
    const apiUrl = credentials.api_url || process.env.NURIX_API_URL;
    const apiKey = credentials.api_key || process.env.NURIX_API_KEY;

    if (apiUrl && apiKey) {
      // Real API call (production path)
      const res = await fetch(`${apiUrl}/calls`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        return (data.calls || []).flatMap((c: Record<string, unknown>) =>
          NurixAdapter.mapWebhook(c)
        );
      }
    }

    // Fallback: sample data (hackathon)
    return NURIX_SAMPLE_CALLS.flatMap((call) => NurixAdapter.mapWebhook(call));
  },

  async testConnection(credentials: Record<string, string>) {
    const apiUrl = credentials.api_url || process.env.NURIX_API_URL;
    const apiKey = credentials.api_key || process.env.NURIX_API_KEY;

    if (!apiUrl || !apiKey) {
      // Hackathon mode — sample data always available
      return { ok: true, detail: "Using sample data (hackathon mode)" };
    }

    try {
      const res = await fetch(`${apiUrl}/health`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return { ok: res.ok, detail: res.ok ? "Connected" : `Error: ${res.status}` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : "Connection failed" };
    }
  },
};
