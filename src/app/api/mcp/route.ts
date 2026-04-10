import { NextRequest, NextResponse } from "next/server";
import { getOrgFromApiKey, errorResponse } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromApiKey(req);
    const { method, params } = await req.json();

    switch (method) {
      case "tools/list":
        return NextResponse.json({ tools: MCP_TOOLS });

      case "resources/list":
        return NextResponse.json({
          resources: [
            { uri: "contextmesh://profiles", name: "Customer/Patient Profiles" },
            { uri: "contextmesh://events", name: "Events & Visits" },
            { uri: "contextmesh://commitments", name: "Commitments" },
            { uri: "contextmesh://alerts", name: "Active Alerts" },
          ],
        });

      case "tools/call":
        return handleToolCall(params, session, req);

      default:
        return NextResponse.json({ error: `Unknown method: ${method}` }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}

async function handleToolCall(
  params: { name: string; arguments: Record<string, unknown> },
  session: { tenantId: string; vertical: string; orgId: string; plan: string },
  req: NextRequest
) {
  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  const headers = { Authorization: authHeader, "Content-Type": "application/json", "x-org-id": session.orgId };

  async function callApi(url: string, method = "GET", body?: unknown) {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({ error: `Upstream returned non-JSON (status ${res.status})` }));
    if (!res.ok) return NextResponse.json({ error: data.error || "Upstream error", status: res.status }, { status: res.status });
    return NextResponse.json(data);
  }

  switch (params.name) {
    case "get_context":
      return callApi(`${baseUrl}/api/agent/context`, "POST", params.arguments);
    case "search":
      return callApi(`${baseUrl}/api/search`, "POST", params.arguments);
    case "analyze":
      return callApi(`${baseUrl}/api/insights`, "POST", params.arguments);
    case "find_similar":
      return callApi(`${baseUrl}/api/search/similar`, "POST", params.arguments);
    case "track_event":
      return callApi(`${baseUrl}/api/events`, "POST", params.arguments);
    case "get_alerts":
      return callApi(`${baseUrl}/api/alerts`);
    case "get_commitments": {
      const qs = new URLSearchParams(params.arguments as Record<string, string>).toString();
      return callApi(`${baseUrl}/api/profiles/${(params.arguments as Record<string, string>).profile_id || ""}?commitments=true&${qs}`);
    }
    default:
      return NextResponse.json({ error: `Unknown tool: ${params.name}` }, { status: 400 });
  }
}

const MCP_TOOLS = [
  {
    name: "get_context",
    description: "Get full pre-conversation brief for a person. Returns profile, events, commitments, risk signals, suggested actions.",
    inputSchema: {
      type: "object",
      properties: {
        phone: { type: "string" },
        email: { type: "string" },
        mrn: { type: "string" },
        profile_id: { type: "string" },
      },
    },
  },
  {
    name: "search",
    description: "Search the context graph using natural language.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language query" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "analyze",
    description: "Get AI insight with reasoning chain for graph context.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        node_ids: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "find_similar",
    description: "Find profiles/events with similar patterns via vector similarity.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: { type: "string" },
        node_label: { type: "string", enum: ["Profile", "Event", "Visit"] },
        limit: { type: "number" },
      },
      required: ["node_id", "node_label"],
    },
  },
  {
    name: "track_event",
    description: "Ingest a new event into the context graph.",
    inputSchema: {
      type: "object",
      properties: {
        event_type: { type: "string" },
        identifiers: { type: "object" },
        properties: { type: "object" },
      },
      required: ["event_type", "identifiers"],
    },
  },
  {
    name: "get_alerts",
    description: "Get active proactive alerts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_commitments",
    description: "Get open/breached commitments for a person.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string" },
        status: { type: "string", enum: ["open", "breached", "all"] },
      },
    },
  },
];
