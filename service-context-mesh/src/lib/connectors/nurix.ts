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
    const apiUrl = credentials.api_url || process.env.NURIX_API_URL;
    const workspaceId = credentials.workspace_id || credentials.api_key || process.env.NURIX_WORKSPACE_ID;
    if (apiUrl && workspaceId) {
      const url = new URL(`${apiUrl}/conversations/`);
      // No agent filter — fetch all conversations for the workspace

      const res = await fetch(url.toString(), {
        headers: {
          "workspace-id": workspaceId,
          "accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        const all = Array.isArray(data) ? data : data.conversations || data.data || [];
        // Sort by latest first, cap at 100 to avoid timeout
        const conversations = all
          .sort((a: Record<string, string>, b: Record<string, string>) =>
            new Date(b.last_message_time || b.created_at || 0).getTime() -
            new Date(a.last_message_time || a.created_at || 0).getTime()
          )
          .slice(0, 100);
        // Fetch phone numbers for unique user_ids in batches of 10
        const uniqueUserIds = Array.from(new Set(conversations.map((c: Record<string, unknown>) => String(c.user_id)).filter(Boolean)));
        const phoneMap: Record<string, string> = {};
        for (let i = 0; i < uniqueUserIds.length; i += 10) {
          const batch = uniqueUserIds.slice(i, i + 10);
          await Promise.allSettled(batch.map(async (uid) => {
            const r = await fetch(`${apiUrl}/voice/users/${uid}`, {
              headers: { "workspace-id": workspaceId, "Content-Type": "application/json" },
            });
            if (r.ok) {
              const u = await r.json();
              const phone = u.decrypted_identifier || u.masked_identifier;
              if (phone && u.identifier_type === "phone") phoneMap[uid] = phone;
            }
          }));
        }

        return conversations
          .filter((c: Record<string, unknown>) => c.user_id)
          .map((c: Record<string, unknown>) => {
            const userId = String(c.user_id ?? "");
            const phone = phoneMap[userId] ?? null;
            return {
              event_type: "support_call",
              identifiers: {
                user_id: userId,
                ...(phone ? { phone } : {}),
              },
              profile_data: { ...(phone ? { phone } : {}) },
              source: "nurix",
              source_id: `nurix_conv_${c.id}`,
              confidence_score: 0.9,
              properties: {
                conversation_id: c.id,
                agent_id: c.agent_id,
                status: c.status,
                last_message_time: c.last_message_time,
                is_human_transferred: c.is_human_transferred,
                channel: c.source || "voice",
                created_at: c.created_at,
              },
              timestamp: String(c.last_message_time || c.created_at || new Date().toISOString()),
            };
          }) as ContextMeshEvent[];
      }
      const errText = await res.text().catch(() => "");
      throw new Error(`Nurix API error ${res.status}: ${errText}`);
    }

    // No credentials — use sample data only in dev
    if (process.env.NODE_ENV === "development") {
      console.warn("[Nurix] No credentials provided, using sample data");
      return NURIX_SAMPLE_CALLS.flatMap((call) => NurixAdapter.mapWebhook(call));
    }
    throw new Error("Nurix credentials not configured");
  },

  async testConnection(credentials: Record<string, string>) {
    const apiUrl = credentials.api_url || process.env.NURIX_API_URL;
    const workspaceId = credentials.workspace_id || credentials.api_key || process.env.NURIX_WORKSPACE_ID;

    if (!apiUrl || !workspaceId) {
      return { ok: true, detail: "Using sample data (no credentials provided)" };
    }

    try {
      const res = await fetch(`${apiUrl}/health`, {
        headers: { "workspace-id": workspaceId, "accept": "application/json" },
      });
      return { ok: res.ok, detail: res.ok ? "Connected to Nurix" : `Error: ${res.status}` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : "Connection failed" };
    }
  },
};
