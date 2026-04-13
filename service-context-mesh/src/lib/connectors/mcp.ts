import { ConnectorAdapter, ContextMeshEvent } from "@/types/connector";

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface MCPCallResult {
  content?: { type: string; text?: string }[];
  result?: unknown;
  data?: unknown;
}

async function mcpRequest<T>(
  serverUrl: string,
  method: string,
  params: unknown,
  apiKey?: string
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(serverUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ method, params }),
  });

  if (!res.ok) throw new Error(`MCP server error: ${res.status}`);
  return res.json() as Promise<T>;
}

function extractEvents(toolName: string, result: MCPCallResult, serverUrl: string): ContextMeshEvent[] {
  // Try to extract data from various MCP response formats
  let raw: unknown = result.data || result.result;

  // Some MCP servers return content array with text
  if (!raw && result.content?.length) {
    const textContent = result.content.find(c => c.type === "text")?.text;
    if (textContent) {
      try { raw = JSON.parse(textContent); } catch { raw = textContent; }
    }
  }

  if (!raw) return [];

  const items = Array.isArray(raw) ? raw : [raw];

  return items
    .filter(item => item && typeof item === "object")
    .map((item: Record<string, unknown>, idx) => {
      // Try to extract common identifier fields
      const email = String(item.email || item.user_email || item.customer_email || "");
      const phone = String(item.phone || item.phone_number || item.mobile || "");
      const userId = String(item.id || item.user_id || item.customer_id || item.record_id || "");
      const name = String(item.name || item.full_name || item.customer_name || "");

      const identifiers: Record<string, string> = {};
      if (email) identifiers.email = email;
      if (phone) identifiers.phone = phone;
      if (userId) identifiers.user_id = userId;
      if (!email && !phone && !userId) identifiers.mcp_id = `${toolName}_${idx}`;

      return {
        event_type: toolName.replace(/_/g, "_"),
        identifiers,
        profile_data: name ? { name } : {},
        source: "mcp",
        source_id: `mcp_${toolName}_${userId || idx}`,
        confidence_score: 0.85,
        properties: { ...item, _mcp_tool: toolName, _mcp_server: serverUrl },
        timestamp: String(item.timestamp || item.created_at || item.date || new Date().toISOString()),
      } as ContextMeshEvent;
    })
    .filter(e => Object.keys(e.identifiers).length > 0);
}

export const MCPAdapter: ConnectorAdapter = {
  type: "mcp",

  mapWebhook(payload: Record<string, unknown>): ContextMeshEvent[] {
    return extractEvents("webhook", payload as MCPCallResult, "");
  },

  async sync(credentials: Record<string, string>): Promise<ContextMeshEvent[]> {
    const serverUrl = credentials.server_url;
    const apiKey = credentials.api_key || undefined;

    if (!serverUrl) return [];

    try {
      // Step 1: Discover available tools
      const toolsResponse = await mcpRequest<{ tools: MCPTool[] }>(
        serverUrl, "tools/list", {}, apiKey
      );
      const tools = toolsResponse.tools || [];

      if (tools.length === 0) return [];

      // Step 2: Call data-fetching tools (skip write/action tools)
      const dataTools = tools.filter(t => {
        const n = t.name.toLowerCase();
        const d = (t.description || "").toLowerCase();
        // Skip tools that clearly write/mutate data
        return !n.includes("create") && !n.includes("update") && !n.includes("delete")
          && !n.includes("send") && !n.includes("post") && !n.includes("write")
          && !d.includes("creates") && !d.includes("updates") && !d.includes("deletes");
      });

      const allEvents: ContextMeshEvent[] = [];

      for (const tool of dataTools.slice(0, 5)) { // max 5 tools per sync
        try {
          const result = await mcpRequest<MCPCallResult>(
            serverUrl, "tools/call", { name: tool.name, arguments: {} }, apiKey
          );
          const events = extractEvents(tool.name, result, serverUrl);
          allEvents.push(...events);
        } catch {
          // Skip failed tools, continue with others
        }
      }

      return allEvents;
    } catch (err) {
      console.error("[MCP sync] error:", err instanceof Error ? err.message : err);
      return [];
    }
  },

  async testConnection(credentials: Record<string, string>) {
    const serverUrl = credentials.server_url;
    const apiKey = credentials.api_key || undefined;

    if (!serverUrl) return { ok: false, detail: "Server URL is required" };

    try {
      const res = await mcpRequest<{ tools: MCPTool[] }>(
        serverUrl, "tools/list", {}, apiKey
      );
      const count = res.tools?.length || 0;
      return { ok: true, detail: `Connected — ${count} tool${count !== 1 ? "s" : ""} available` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : "Connection failed" };
    }
  },
};
