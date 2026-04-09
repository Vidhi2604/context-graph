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
  const headers = { Authorization: req.headers.get("Authorization")!, "Content-Type": "application/json", "x-org-id": session.orgId };

  switch (params.name) {
    case "get_context": {
      const res = await fetch(`${baseUrl}/api/agent/context`, { method: "POST", headers, body: JSON.stringify(params.arguments) });
      return NextResponse.json(await res.json());
    }
    case "search": {
      const res = await fetch(`${baseUrl}/api/search`, { method: "POST", headers, body: JSON.stringify(params.arguments) });
      return NextResponse.json(await res.json());
    }
    case "analyze": {
      const res = await fetch(`${baseUrl}/api/insights`, { method: "POST", headers, body: JSON.stringify(params.arguments) });
      return NextResponse.json(await res.json());
    }
    case "find_similar": {
      const res = await fetch(`${baseUrl}/api/search/similar`, { method: "POST", headers, body: JSON.stringify(params.arguments) });
      return NextResponse.json(await res.json());
    }
    case "track_event": {
      const res = await fetch(`${baseUrl}/api/events`, { method: "POST", headers, body: JSON.stringify(params.arguments) });
      return NextResponse.json(await res.json());
    }
    case "get_alerts": {
      const res = await fetch(`${baseUrl}/api/alerts`, { headers });
      return NextResponse.json(await res.json());
    }
    case "get_commitments": {
      const qs = new URLSearchParams(params.arguments as Record<string, string>).toString();
      const res = await fetch(`${baseUrl}/api/profiles/${params.arguments.profile_id || ""}?commitments=true&${qs}`, { headers });
      return NextResponse.json(await res.json());
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
