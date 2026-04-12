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

  async liveSearch(query: string, credentials: Record<string, string>): Promise<ContextMeshEvent[]> {
    const { subdomain, email: adminEmail, api_token } = credentials;
    if (!subdomain || !adminEmail || !api_token) return [];

    const auth = Buffer.from(`${adminEmail}/token:${api_token}`).toString("base64");
    const events: ContextMeshEvent[] = [];
    // email lookup from user results
    const emailByRequesterId: Record<string, string> = {};
    const nameByRequesterId: Record<string, string> = {};

    try {
      const res = await fetch(
        `https://${subdomain}.zendesk.com/api/v2/search.json?query=${encodeURIComponent(query)}&per_page=10`,
        { headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" } }
      );
      if (!res.ok) return [];

      const data = await res.json();
      const results: Record<string, unknown>[] = data.results || [];

      // First pass — collect user info
      for (const item of results) {
        if (item.result_type === "user") {
          const uid = String(item.id || "");
          if (uid && item.email) emailByRequesterId[uid] = item.email as string;
          if (uid && item.name) nameByRequesterId[uid] = item.name as string;
          // Also emit a contact_updated event for the user
          if (item.email || item.name) {
            events.push({
              event_type: "contact_updated",
              identifiers: {
                ...(item.email ? { email: item.email as string } : {}),
                crm_id: uid,
              },
              profile_data: { ...(item.name ? { name: item.name as string } : {}) },
              source: "zendesk",
              source_id: `zd_user_${uid}`,
              confidence_score: 0.93,
              properties: { role: item.role },
            });
          }
        }
      }

      // Second pass — process tickets using collected user info
      for (const item of results) {
        if (item.result_type === "ticket") {
          const ticketId = String(item.id || "");
          if (!ticketId) continue;
          const requesterId = String(item.requester_id || "");
          const email = emailByRequesterId[requesterId] || "";
          const name = nameByRequesterId[requesterId] || "";
          const status = item.status as string;

          events.push({
            event_type: status === "solved" || status === "closed" ? "ticket_resolved" : "support_ticket",
            identifiers: { ...(email ? { email } : {}), ticket_id: ticketId },
            profile_data: { ...(name ? { name } : {}) },
            source: "zendesk",
            source_id: `zd_ticket_${ticketId}`,
            confidence_score: 0.93,
            properties: { subject: item.subject, priority: item.priority, status },
          });
        }
      }
    } catch { /* silent */ }

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
