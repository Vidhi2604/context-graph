import { ConnectorAdapter, ContextMeshEvent } from "@/types/connector";

export const SalesforceAdapter: ConnectorAdapter = {
  type: "salesforce" as never, // extended type

  mapWebhook(payload: Record<string, unknown>): ContextMeshEvent[] {
    const events: ContextMeshEvent[] = [];
    const sobjectType = (payload.sobjectType as string || "").toLowerCase();
    const body = (payload.body || payload) as Record<string, unknown>;

    if (sobjectType.includes("contact") || sobjectType.includes("lead")) {
      const email = body.Email as string;
      const phone = body.Phone as string || body.MobilePhone as string;
      const name = [body.FirstName, body.LastName].filter(Boolean).join(" ");

      if (email || phone) {
        events.push({
          event_type: "contact_updated",
          identifiers: {
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            crm_id: String(body.Id || ""),
          },
          profile_data: { name, tier: mapRatingToTier(body.Rating as string) },
          source: "salesforce",
          source_id: `sf_contact_${body.Id}`,
          confidence_score: 0.93,
          properties: body,
        });
      }
    }

    if (sobjectType.includes("opportunity")) {
      events.push({
        event_type: body.StageName === "Closed Won" ? "deal_won" : "deal_stage_changed",
        identifiers: { crm_id: String(body.Id || "") },
        source: "salesforce",
        source_id: `sf_opp_${body.Id}`,
        confidence_score: 0.9,
        properties: {
          deal_name: body.Name,
          stage: body.StageName,
          amount: body.Amount,
          close_date: body.CloseDate,
        },
      });
    }

    if (sobjectType.includes("case")) {
      events.push({
        event_type: body.Status === "Closed" ? "ticket_closed" : "support_ticket",
        identifiers: { crm_id: String(body.Id || "") },
        source: "salesforce",
        source_id: `sf_case_${body.Id}`,
        confidence_score: 0.9,
        properties: {
          subject: body.Subject,
          priority: body.Priority,
          status: body.Status,
        },
      });
    }

    return events;
  },

  async sync(
    credentials: Record<string, string>,
    since?: string
  ): Promise<ContextMeshEvent[]> {
    const { access_token, instance_url } = credentials;
    if (!access_token || !instance_url) {
      throw new Error("Salesforce access_token and instance_url required");
    }

    const events: ContextMeshEvent[] = [];
    const sinceDate = since
      ? new Date(since).toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const soql = encodeURIComponent(
      `SELECT Id, FirstName, LastName, Email, Phone, MobilePhone, Rating, LastModifiedDate FROM Contact WHERE LastModifiedDate >= ${sinceDate} LIMIT 100`
    );

    const res = await fetch(`${instance_url}/services/data/v58.0/query?q=${soql}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (res.ok) {
      const data = await res.json();
      for (const record of data.records || []) {
        const email = record.Email;
        const phone = record.Phone || record.MobilePhone;
        if (!email && !phone) continue;

        events.push({
          event_type: "contact_updated",
          identifiers: {
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            crm_id: record.Id,
          },
          profile_data: {
            name: [record.FirstName, record.LastName].filter(Boolean).join(" "),
            tier: mapRatingToTier(record.Rating),
          },
          source: "salesforce",
          source_id: `sf_contact_${record.Id}`,
          confidence_score: 0.93,
        });
      }
    }

    return events;
  },

  async testConnection(credentials: Record<string, string>) {
    try {
      const { access_token, instance_url } = credentials;
      const res = await fetch(`${instance_url}/services/data/v58.0/limits`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      return { ok: res.ok, detail: res.ok ? "Connected to Salesforce" : `Error: ${res.status}` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : "Connection failed" };
    }
  },
};

function mapRatingToTier(rating: string): string {
  const map: Record<string, string> = {
    Hot: "Platinum",
    Warm: "Gold",
    Cold: "Bronze",
  };
  return map[rating] || "Bronze";
}
