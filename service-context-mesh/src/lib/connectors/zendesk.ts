import { ConnectorAdapter, ContextMeshEvent } from "@/types/connector";

export const ZendeskAdapter: ConnectorAdapter = {
  type: "zendesk",

  mapWebhook(payload: Record<string, unknown>): ContextMeshEvent[] {
    const events: ContextMeshEvent[] = [];
    const ticket = (payload.ticket || payload) as Record<string, unknown>;
    const requester = (ticket.requester || {}) as Record<string, unknown>;

    const email = requester.email as string;
    const name = requester.name as string;
    const ticketId = String(ticket.id || "");
    const status = ticket.status as string;
    const priority = ticket.priority as string;
    const subject = ticket.subject as string;
    const channel = (ticket.via as Record<string, unknown>)?.channel as string;

    if (!ticketId) return events;

    // Main ticket event
    const eventType = status === "solved" || status === "closed"
      ? "ticket_resolved" : "support_ticket";

    events.push({
      event_type: eventType,
      identifiers: {
        ...(email ? { email } : {}),
        ticket_id: ticketId,
      },
      profile_data: { ...(name ? { name } : {}) },
      source: "zendesk",
      source_id: `zd_ticket_${ticketId}`,
      confidence_score: 0.93,
      properties: { subject, priority, status, channel },
      agent: ticket.assignee
        ? {
            name: (ticket.assignee as Record<string, unknown>).name as string,
            role: "Support Agent",
          }
        : undefined,
    });

    // Escalation — priority increase
    if (priority === "urgent" || priority === "high") {
      events.push({
        event_type: "ticket_escalated",
        identifiers: { ...(email ? { email } : {}), ticket_id: ticketId },
        source: "zendesk",
        source_id: `zd_escalation_${ticketId}`,
        confidence_score: 0.88,
        properties: { to_priority: priority, subject },
      });
    }

    // CSAT rating
    const csat = ticket.satisfaction_rating as Record<string, unknown> | undefined;
    if (csat?.score) {
      events.push({
        event_type: "satisfaction_rated",
        identifiers: { ...(email ? { email } : {}), ticket_id: ticketId },
        source: "zendesk",
        source_id: `zd_csat_${ticketId}`,
        confidence_score: 0.95,
        properties: { score: csat.score, comment: csat.comment },
      });
    }

    return events;
  },

  async sync(
    credentials: Record<string, string>,
    since?: string
  ): Promise<ContextMeshEvent[]> {
    const { subdomain, email: adminEmail, api_token } = credentials;
    if (!subdomain || !adminEmail || !api_token) {
      throw new Error("Zendesk requires subdomain, email, and api_token");
    }

    const auth = Buffer.from(`${adminEmail}/token:${api_token}`).toString("base64");
    const sinceParam = since ? `&updated_after=${encodeURIComponent(since)}` : "";

    const events: ContextMeshEvent[] = [];

    const res = await fetch(
      `https://${subdomain}.zendesk.com/api/v2/tickets.json?page[size]=50${sinceParam}`,
      { headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" } }
    );

    if (!res.ok) throw new Error(`Zendesk API error: ${res.status}`);

    const data = await res.json();
    for (const ticket of data.tickets || []) {
      const mapped = ZendeskAdapter.mapWebhook({ ticket });
      events.push(...mapped);
    }

    return events;
  },

  async testConnection(credentials: Record<string, string>) {
    try {
      const { subdomain, email, api_token } = credentials;
      const auth = Buffer.from(`${email}/token:${api_token}`).toString("base64");
      const res = await fetch(
        `https://${subdomain}.zendesk.com/api/v2/tickets.json?page[size]=1`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
      return { ok: res.ok, detail: res.ok ? "Connected" : `Error: ${res.status}` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : "Connection failed" };
    }
  },
};
