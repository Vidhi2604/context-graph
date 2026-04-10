import { ConnectorAdapter, ContextMeshEvent } from "@/types/connector";

export const HubSpotAdapter: ConnectorAdapter = {
  type: "hubspot",

  mapWebhook(payload: Record<string, unknown>): ContextMeshEvent[] {
    const events: ContextMeshEvent[] = [];
    const objectType = payload.subscriptionType as string || "";
    const props = (payload.properties || {}) as Record<string, unknown>;

    // Contact property change → contact_updated event
    if (objectType.includes("contact")) {
      const email = props.email as string || payload.email as string;
      const phone = props.phone as string || props.mobilephone as string;
      const name = [props.firstname, props.lastname].filter(Boolean).join(" ");
      const lifecycleStage = props.lifecyclestage as string;

      if (email || phone) {
        events.push({
          event_type: "contact_updated",
          identifiers: {
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            crm_id: String(payload.objectId || ""),
          },
          profile_data: {
            ...(name ? { name } : {}),
            tier: mapLifecycleToTier(lifecycleStage),
          },
          source: "hubspot",
          source_id: `hs_contact_${payload.objectId}`,
          confidence_score: 0.95,
          properties: { lifecycle_stage: lifecycleStage, ...props },
        });
      }
    }

    // Deal stage change → deal_stage_changed event
    if (objectType.includes("deal")) {
      const dealName = props.dealname as string;
      const dealStage = props.dealstage as string;
      const amount = parseFloat(props.amount as string || "0");
      const associatedEmail = props.email as string;

      events.push({
        event_type: dealStage === "closedwon" ? "deal_won" : "deal_stage_changed",
        identifiers: {
          ...(associatedEmail ? { email: associatedEmail } : {}),
          crm_id: String(payload.objectId || ""),
        },
        source: "hubspot",
        source_id: `hs_deal_${payload.objectId}`,
        confidence_score: 0.9,
        properties: { deal_name: dealName, stage: dealStage, amount },
      });
    }

    // Ticket → support_ticket event
    if (objectType.includes("ticket")) {
      const subject = props.subject as string;
      const priority = props.hs_ticket_priority as string;
      const status = props.hs_pipeline_stage as string;
      const email = props.email as string;

      events.push({
        event_type: status === "closed" ? "ticket_closed" : "support_ticket",
        identifiers: { ...(email ? { email } : {}), crm_id: String(payload.objectId || "") },
        source: "hubspot",
        source_id: `hs_ticket_${payload.objectId}`,
        confidence_score: 0.92,
        properties: { subject, priority, status },
      });
    }

    return events;
  },

  async sync(
    credentials: Record<string, string>,
    since?: string
  ): Promise<ContextMeshEvent[]> {
    const token = credentials.access_token;
    if (!token) throw new Error("HubSpot access_token required");

    const events: ContextMeshEvent[] = [];
    const sinceTs = since ? new Date(since).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Pull contacts modified since
    const contactsRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts?limit=50&properties=email,phone,firstname,lastname,lifecyclestage&filterGroups=[{"filters":[{"propertyName":"lastmodifieddate","operator":"GTE","value":"${sinceTs}"}]}]`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (contactsRes.ok) {
      const data = await contactsRes.json();
      for (const contact of data.results || []) {
        const p = contact.properties;
        const email = p.email;
        const phone = p.phone;
        if (!email && !phone) continue;

        events.push({
          event_type: "contact_updated",
          identifiers: {
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            crm_id: contact.id,
          },
          profile_data: {
            name: [p.firstname, p.lastname].filter(Boolean).join(" "),
            tier: mapLifecycleToTier(p.lifecyclestage),
          },
          source: "hubspot",
          source_id: `hs_contact_${contact.id}`,
          confidence_score: 0.95,
        });
      }
    }

    return events;
  },

  async testConnection(credentials: Record<string, string>) {
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
        headers: { Authorization: `Bearer ${credentials.access_token}` },
      });
      return { ok: res.ok, detail: res.ok ? "Connected" : `Error: ${res.status}` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : "Connection failed" };
    }
  },
};

function mapLifecycleToTier(stage: string): string {
  const map: Record<string, string> = {
    lead: "Bronze",
    marketingqualifiedlead: "Bronze",
    salesqualifiedlead: "Silver",
    opportunity: "Silver",
    customer: "Gold",
    evangelist: "Platinum",
  };
  return map[stage?.toLowerCase()] || "Bronze";
}
