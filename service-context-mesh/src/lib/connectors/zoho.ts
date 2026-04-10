import { ConnectorAdapter, ContextMeshEvent } from "@/types/connector";

export const ZohoAdapter: ConnectorAdapter = {
  type: "zoho" as never, // extended type

  mapWebhook(payload: Record<string, unknown>): ContextMeshEvent[] {
    const events: ContextMeshEvent[] = [];
    const moduleName = (payload.module as string || "").toLowerCase();
    const data = (payload.data || payload) as Record<string, unknown>;

    if (moduleName === "contacts" || moduleName === "leads") {
      const email = data.Email as string;
      const phone = data.Phone as string || data.Mobile as string;
      const name = [data.First_Name, data.Last_Name].filter(Boolean).join(" ");

      if (email || phone) {
        events.push({
          event_type: "contact_updated",
          identifiers: {
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            crm_id: String(data.id || data.ID || ""),
          },
          profile_data: { name, tier: mapLeadSourceToTier(data.Lead_Source as string) },
          source: "zoho",
          source_id: `zoho_contact_${data.id}`,
          confidence_score: 0.9,
          properties: data,
        });
      }
    }

    if (moduleName === "deals" || moduleName === "potentials") {
      events.push({
        event_type: data.Stage === "Closed Won" ? "deal_won" : "deal_stage_changed",
        identifiers: { crm_id: String(data.id || "") },
        source: "zoho",
        source_id: `zoho_deal_${data.id}`,
        confidence_score: 0.88,
        properties: {
          deal_name: data.Deal_Name,
          stage: data.Stage,
          amount: data.Amount,
          closing_date: data.Closing_Date,
        },
      });
    }

    return events;
  },

  async sync(
    credentials: Record<string, string>,
    since?: string
  ): Promise<ContextMeshEvent[]> {
    const { access_token } = credentials;
    if (!access_token) throw new Error("Zoho access_token required");

    const events: ContextMeshEvent[] = [];
    const sinceDate = since
      ? new Date(since).toISOString().split("T")[0]
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const res = await fetch(
      `https://www.zohoapis.com/crm/v3/Contacts?fields=First_Name,Last_Name,Email,Phone,Mobile,Lead_Source&modified_since=${sinceDate}&per_page=100`,
      { headers: { Authorization: `Zoho-oauthtoken ${access_token}` } }
    );

    if (res.ok) {
      const data = await res.json();
      for (const record of data.data || []) {
        const email = record.Email;
        const phone = record.Phone || record.Mobile;
        if (!email && !phone) continue;

        events.push({
          event_type: "contact_updated",
          identifiers: {
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            crm_id: record.id,
          },
          profile_data: {
            name: [record.First_Name, record.Last_Name].filter(Boolean).join(" "),
            tier: mapLeadSourceToTier(record.Lead_Source),
          },
          source: "zoho",
          source_id: `zoho_contact_${record.id}`,
          confidence_score: 0.9,
        });
      }
    }

    return events;
  },

  async testConnection(credentials: Record<string, string>) {
    try {
      const res = await fetch("https://www.zohoapis.com/crm/v3/org", {
        headers: { Authorization: `Zoho-oauthtoken ${credentials.access_token}` },
      });
      return { ok: res.ok, detail: res.ok ? "Connected to Zoho CRM" : `Error: ${res.status}` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : "Connection failed" };
    }
  },
};

function mapLeadSourceToTier(source: string): string {
  const map: Record<string, string> = {
    "Web Site": "Gold",
    "Cold Call": "Bronze",
    "Partner": "Platinum",
    "Internal Seminar": "Silver",
  };
  return map[source] || "Bronze";
}
