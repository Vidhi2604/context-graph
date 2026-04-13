"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  auth: string;
  request?: string;
  response: string;
  notes?: string;
}

interface Section {
  id: string;
  title: string;
  description: string;
  endpoints: Endpoint[];
}

// ── Method badge colors ───────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-emerald-900/40 text-emerald-400 border border-emerald-800",
  POST:   "bg-blue-900/40 text-blue-400 border border-blue-800",
  PUT:    "bg-yellow-900/40 text-yellow-400 border border-yellow-800",
  DELETE: "bg-red-900/40 text-red-400 border border-red-800",
};

// ── API Sections ──────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: "auth",
    title: "Authentication",
    description: "All API requests require an API key. Get yours from Settings → API Key.",
    endpoints: [
      {
        method: "POST",
        path: "/api/auth/register",
        description: "Register a new user account",
        auth: "None",
        request: `{
  "name": "Priya Mehta",
  "email": "priya@company.com",
  "password": "your-password"
}`,
        response: `{
  "id": "user_abc123",
  "email": "priya@company.com"
}`,
      },
      {
        method: "POST",
        path: "/api/org",
        description: "Create an organization (after signup)",
        auth: "None",
        request: `{
  "name": "Myntra",
  "vertical": "retail",
  "userId": "user_abc123"
}`,
        response: `{
  "id": "org_abc123",
  "tenantId": "tenant_xyz",
  "apiKey": "sk_tenant_xyz_abc...def",
  "plan": "starter"
}`,
        notes: "Save the apiKey — it's returned only once. Use it in Authorization header for all subsequent requests.",
      },
    ],
  },
  {
    id: "events",
    title: "Event Ingestion",
    description: "Push events into the context graph. Three ingestion paths — same pipeline behind all of them.",
    endpoints: [
      {
        method: "POST",
        path: "/api/events",
        description: "Ingest a single structured event",
        auth: "Bearer API key",
        request: `{
  "event_type": "return_initiated",
  "identifiers": {
    "email": "priya@gmail.com",
    "phone": "9876543210"
  },
  "profile_data": {
    "name": "Priya Mehta",
    "tier": "Gold",
    "city": "Bangalore"
  },
  "timestamp": "2026-04-10T14:30:00Z",
  "amount": 8499,
  "channel": "app",
  "product": {
    "name": "Nike Air Max",
    "category": "Footwear",
    "brand": "Nike",
    "price": 8499
  },
  "policy": {
    "name": "Return Policy",
    "version": "v3.2",
    "exception": true
  },
  "agent": {
    "name": "Ravi K.",
    "role": "L2 Support"
  }
}`,
        response: `{
  "accepted": true,
  "mode": "stream",
  "message_id": "1713758400000-0",
  "stream": "stream:tenant_xyz"
}`,
        notes: "Events are processed asynchronously via Redis Streams. Call POST /api/streams/consume to process queued events.",
      },
      {
        method: "POST",
        path: "/api/events/batch",
        description: "Bulk ingest up to 1000 events",
        auth: "Bearer API key",
        request: `{
  "events": [
    { "event_type": "purchase", "identifiers": { "email": "user@x.com" }, "amount": 999 },
    { "event_type": "return_initiated", "identifiers": { "email": "user@x.com" }, "amount": 999 }
  ]
}`,
        response: `{
  "accepted": true,
  "queued": 2,
  "mode": "stream"
}`,
      },
      {
        method: "POST",
        path: "/api/events/transcript",
        description: "Ingest a voice call / STT transcript. LLM extracts structured events automatically.",
        auth: "Bearer API key",
        request: `{
  "source": "voice_stt",
  "call_id": "call_abc123",
  "participants": [
    { "role": "customer", "phone": "9876543210" },
    { "role": "agent", "name": "Ravi K.", "agent_id": "agent_001" }
  ],
  "transcript": [
    { "speaker": "customer", "text": "I want to return my Nike shoes, size is wrong." },
    { "speaker": "agent", "text": "I'll approve the return. Refund within 48 hours." }
  ]
}`,
        response: `{
  "accepted": true,
  "events_extracted": 2,
  "commitments_extracted": 1,
  "sentiment": { "trajectory": "frustrated → resolved", "score": 0.7 }
}`,
        notes: "Confidence scores are added to each extracted event. High confidence (>0.85) auto-commits, lower goes to review queue in production.",
      },
      {
        method: "POST",
        path: "/api/ingest/raw",
        description: "Accept ANY JSON format — no schema required. Use ?client=myntra for field mapping.",
        auth: "Bearer API key",
        request: `// Myntra native format — no schema change needed
{
  "customer_email": "priya@gmail.com",
  "event_name": "order_placed",
  "order_value": 8499,
  "item_name": "Nike Air Max",
  "platform": "app"
}`,
        response: `{
  "accepted": true,
  "events_mapped": 1,
  "events_ingested": 1,
  "mode": "sync",
  "client_config": "myntra"
}`,
        notes: "Supported client configs: myntra, flipkart, care_hospitals, hubspot, zendesk. Omit ?client= for auto-detection.",
      },
    ],
  },
  {
    id: "search",
    title: "Search & Graph",
    description: "Natural language search across the context graph. Returns connected nodes, edges, and timeline.",
    endpoints: [
      {
        method: "POST",
        path: "/api/search",
        description: "Universal natural language search. LLM converts query to Cypher and executes against Neo4j.",
        auth: "x-org-id header or Bearer API key",
        request: `{
  "query": "Gold tier returns in Bangalore last 30 days",
  "limit": 50
}`,
        response: `{
  "query": "Gold tier returns in Bangalore last 30 days",
  "interpretation": "Search for Gold tier customer return events in Bangalore",
  "cypher_confidence": 0.91,
  "results": {
    "nodes": [
      { "id": "prof_001", "label": "Profile", "displayName": "Priya Mehta", "color": "#10b981" },
      { "id": "evt_001", "label": "Event", "displayName": "return_initiated", "color": "#3b82f6" }
    ],
    "edges": [
      { "id": "prof_001-PERFORMED-evt_001", "source": "prof_001", "target": "evt_001", "type": "PERFORMED" }
    ],
    "timeline": [...]
  }
}`,
        notes: "Add ?trace=true to see the full pipeline execution trace (Auth → LLM → Neo4j → Mapping → Scoring).",
      },
      {
        method: "POST",
        path: "/api/search/similar",
        description: "Find profiles or events with similar patterns using structural graph similarity.",
        auth: "x-org-id header or Bearer API key",
        request: `{
  "node_id": "prof_priya_001",
  "node_label": "Profile",
  "limit": 5
}`,
        response: `{
  "source": { "node_id": "prof_priya_001", "node_label": "Profile" },
  "similar": [
    { "node": {...}, "shared_connections": 4 },
    { "node": {...}, "shared_connections": 3 }
  ]
}`,
      },
      {
        method: "POST",
        path: "/api/graph/explore",
        description: "Expand a node's connections. Used when clicking a node to re-center the graph.",
        auth: "x-org-id header or Bearer API key",
        request: `{
  "node_id": "prof_priya_001",
  "node_label": "Profile",
  "depth": 2
}`,
        response: `{
  "nodes": [...],
  "edges": [...],
  "timeline": [...],
  "centerNodeId": "prof_priya_001"
}`,
      },
    ],
  },
  {
    id: "insights",
    title: "AI Insights",
    description: "LLM-powered analysis with full reasoning chain. Context → Reasoning → Result.",
    endpoints: [
      {
        method: "POST",
        path: "/api/insights",
        description: "Analyze graph context and return reasoning chain with confidence scores.",
        auth: "x-org-id header or Bearer API key",
        request: `{
  "query": "Why are Nike returns spiking?",
  "nodes": [
    { "label": "Event", "displayName": "return_initiated", "properties": {...} }
  ]
}`,
        response: `{
  "context": {
    "summary": "Analyzing 5 Nike return events across Gold tier users",
    "data_points": ["4 of 5 cite size_runs_small", "All approved as exceptions"],
    "graph_scope": "5 Users, 8 Events, 2 Products"
  },
  "reasoning": [
    { "step": 1, "observation": "80% cite sizing", "implication": "Preventable", "confidence": 0.92 },
    { "step": 2, "observation": "Policy overridden 60%", "implication": "Policy drift", "confidence": 0.88 }
  ],
  "result": {
    "finding": "Systemic sizing issue driving 34% return rate",
    "recommendation": "Add size guide to Nike product pages",
    "confidence": 0.87,
    "impact": "Estimated 40% reduction in returns"
  }
}`,
        notes: "Pro plan: result only. Enterprise: full reasoning chain. Add ?trace=true for pipeline trace.",
      },
    ],
  },
  {
    id: "agent",
    title: "Agent Context API",
    description: "Pre-conversation brief for AI agents and human agents. Returns full context in <300ms.",
    endpoints: [
      {
        method: "POST",
        path: "/api/agent/context",
        description: "Get full pre-conversation context for a person. Pass any identifier — we resolve to the unified profile.",
        auth: "Bearer API key",
        request: `{
  "phone": "9876543210"
}

// Or by email:
{ "email": "priya@gmail.com" }

// Or by MRN (healthcare):
{ "mrn": "MH-4829" }`,
        response: `{
  "profile": { "name": "Priya Mehta", "tier": "Gold", "city": "Bangalore", "ltv": 120000, "risk_score": 0.72 },
  "recent_events": [
    { "type": "return_initiated", "product": "Nike Air Max", "days_ago": 3, "relevance": 0.94 }
  ],
  "open_commitments": [
    { "promise": "Refund within 48h", "deadline": "2026-04-11", "status": "breached" }
  ],
  "risk_signals": ["1 breached commitment", "2 returns in 30 days"],
  "suggested_actions": [
    { "action": "Apologize for delayed refund", "confidence": 0.95 },
    { "action": "Offer express processing", "confidence": 0.88 }
  ]
}`,
        notes: "Response time: <100ms with cache, <300ms without. Cache TTL: 15 minutes. Invalidated on new event.",
      },
      {
        method: "POST",
        path: "/api/mcp",
        description: "MCP Server — auto-discoverable by any MCP-compatible AI agent (Claude, LangChain, CrewAI).",
        auth: "Bearer API key",
        request: `// List available tools
{ "method": "tools/list", "params": {} }

// Call a tool
{
  "method": "tools/call",
  "params": {
    "name": "get_context",
    "arguments": { "phone": "9876543210" }
  }
}`,
        response: `// tools/list response
{
  "tools": [
    { "name": "get_context", "description": "Full pre-conversation brief" },
    { "name": "search", "description": "Natural language graph search" },
    { "name": "analyze", "description": "AI insight with reasoning chain" },
    { "name": "find_similar", "description": "Vector similarity search" },
    { "name": "track_event", "description": "Ingest a new event" },
    { "name": "get_alerts", "description": "Active proactive alerts" },
    { "name": "get_commitments", "description": "Open/breached commitments" }
  ]
}`,
        notes: "Connect any MCP agent: { mcpServers: { contextmesh: { url: 'https://your-app/api/mcp', apiKey: 'sk_...' } } }",
      },
    ],
  },
  {
    id: "connectors",
    title: "Connectors",
    description: "Connect external systems. Pull data IN from CRMs, support tools, and voice platforms.",
    endpoints: [
      {
        method: "GET",
        path: "/api/connectors",
        description: "List all configured connectors (credentials masked)",
        auth: "x-org-id header or Bearer API key",
        request: undefined,
        response: `{
  "connectors": [
    { "id": "conn_abc", "type": "hubspot", "name": "HubSpot", "active": true }
  ]
}`,
      },
      {
        method: "POST",
        path: "/api/connectors",
        description: "Register a new connector. Tests connection before saving.",
        auth: "x-org-id header or Bearer API key",
        request: `{
  "type": "hubspot",
  "name": "Myntra HubSpot",
  "credentials": {
    "access_token": "pat-na1-..."
  }
}`,
        response: `{
  "connector": { "id": "conn_abc", "type": "hubspot", "active": true },
  "connection_test": { "ok": true, "detail": "Connected" }
}`,
      },
      {
        method: "POST",
        path: "/api/connectors/sync",
        description: "Trigger a sync pull from a connector. Fetches new data since last sync.",
        auth: "x-org-id header or Bearer API key",
        request: `// Sync specific connector
{ "connector_id": "conn_abc" }

// Or sync by type
{ "type": "hubspot", "since": "2026-04-01T00:00:00Z" }

// Or sync all (includes Nurix samples if no API configured)
{}`,
        response: `{
  "sync_result": { "events_synced": 47, "events_failed": 0 },
  "pipeline_result": { "events_pushed": 47, "events_ingested": 45 }
}`,
      },
      {
        method: "POST",
        path: "/api/ingest/hubspot",
        description: "Webhook receiver for HubSpot subscription events. Configure in HubSpot → Private Apps → Webhooks.",
        auth: "Bearer API key",
        request: `// HubSpot sends this automatically on contact/deal/ticket events
{
  "subscriptionType": "contact.propertyChange",
  "objectId": 12345,
  "properties": {
    "email": "priya@gmail.com",
    "lifecyclestage": "customer"
  }
}`,
        response: `{ "accepted": true, "events_mapped": 1, "events_ingested": 1 }`,
      },
      {
        method: "POST",
        path: "/api/ingest/zendesk",
        description: "Webhook receiver for Zendesk trigger events.",
        auth: "Bearer API key",
        request: `{
  "ticket": {
    "id": 4829,
    "status": "open",
    "priority": "high",
    "subject": "Return request",
    "requester": { "email": "priya@gmail.com", "name": "Priya Mehta" }
  }
}`,
        response: `{ "accepted": true, "events_mapped": 1 }`,
      },
      {
        method: "POST",
        path: "/api/ingest/raw",
        description: "Accept any JSON format. Supports single events or arrays up to 1000.",
        auth: "Bearer API key",
        request: `// ?client=myntra for Myntra field mapping
// ?client=care_hospitals for healthcare
// No ?client= for auto-detection

[
  { "customer_email": "u1@x.com", "event_name": "purchase", "amount": 999 },
  { "customer_email": "u2@x.com", "event_name": "return_initiated", "amount": 999 }
]`,
        response: `{
  "accepted": true,
  "total_received": 2,
  "events_mapped": 2,
  "events_ingested": 2
}`,
      },
    ],
  },
  {
    id: "streams",
    title: "Redis Streams Pipeline",
    description: "Async event processing via Upstash Redis Streams. Events are queued then consumed.",
    endpoints: [
      {
        method: "POST",
        path: "/api/streams/consume",
        description: "Process queued events from Redis Stream → identity resolution → graph write.",
        auth: "x-org-id header or Bearer API key",
        request: undefined,
        response: `{
  "processed": 12,
  "skipped": 0,
  "failed": 0,
  "stream": { "key": "stream:tenant_xyz", "length": 0 }
}`,
        notes: "Add ?trace=true to see each step: Redis Consume → Identity Resolution → Graph Write → Commitment Extraction.",
      },
      {
        method: "GET",
        path: "/api/streams/consume",
        description: "Get stream status — how many events are queued.",
        auth: "x-org-id header or Bearer API key",
        request: undefined,
        response: `{
  "stream": { "key": "stream:tenant_xyz", "length": 5, "last_id": "1713758400000-0" },
  "configured": true
}`,
      },
    ],
  },
  {
    id: "profiles",
    title: "Profiles & Alerts",
    description: "Query resolved profiles, get proactive alerts, and view platform stats.",
    endpoints: [
      {
        method: "GET",
        path: "/api/profiles/[id]",
        description: "Get a full profile with all events, identities, and commitments.",
        auth: "x-org-id header or Bearer API key",
        request: undefined,
        response: `{
  "profile": { "profile_id": "prof_001", "name": "Priya Mehta", "tier": "Gold" },
  "events": [...],
  "commitments": [
    { "promise": "Refund within 48h", "status": "breached", "deadline": "2026-04-11" }
  ]
}`,
      },
      {
        method: "GET",
        path: "/api/alerts",
        description: "Get active proactive alerts — policy drift, risk signals, anomaly spikes.",
        auth: "x-org-id header or Bearer API key",
        request: undefined,
        response: `{
  "alerts": [
    {
      "type": "policy_drift",
      "severity": "warning",
      "title": "Return Policy v3.2: 72% override rate",
      "description": "47 overrides in last 90 days (threshold: 30%)"
    },
    {
      "type": "risk_signal",
      "severity": "critical",
      "title": "Churn risk: Priya Mehta (Gold tier)",
      "description": "Risk score: 0.84 — 1 breached commitment, 2 returns"
    }
  ]
}`,
      },
      {
        method: "GET",
        path: "/api/stats",
        description: "Platform metrics — events tracked, profiles resolved, commitments, confidence.",
        auth: "x-org-id header or Bearer API key",
        request: undefined,
        response: `{
  "events_tracked": 1135,
  "profiles_resolved": 200,
  "identity_fragments": 400,
  "commitments": { "open": 29, "fulfilled": 0, "breached": 0 },
  "avg_extraction_confidence": 0.98
}`,
      },
    ],
  },
];

// ── Components ────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-[10px] text-gray-600 hover:text-gray-300 transition-colors"
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-gray-800/40 transition-colors"
      >
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded font-mono ${METHOD_COLORS[ep.method]}`}>
          {ep.method}
        </span>
        <span className="text-sm font-mono text-gray-300">{ep.path}</span>
        <span className="text-xs text-gray-500 flex-1">{ep.description}</span>
        <span className="text-gray-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-4 bg-gray-900/50">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-600 uppercase tracking-wide">Auth:</span>
            <span className="text-[11px] text-gray-400 font-mono">{ep.auth}</span>
          </div>

          {ep.request && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-gray-600 uppercase tracking-wide">Request Body</span>
                <CopyButton text={ep.request} />
              </div>
              <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-[11px] text-green-400 font-mono overflow-x-auto leading-relaxed">
                {ep.request}
              </pre>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-600 uppercase tracking-wide">Response</span>
              <CopyButton text={ep.response} />
            </div>
            <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-[11px] text-blue-300 font-mono overflow-x-auto leading-relaxed">
              {ep.response}
            </pre>
          </div>

          {ep.notes && (
            <div className="bg-yellow-900/10 border border-yellow-900/30 rounded-lg px-3 py-2 text-[11px] text-yellow-300/80">
              💡 {ep.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState("auth");
  const [baseUrl, setBaseUrl] = useState("https://your-app.com");
  useEffect(() => { setBaseUrl(window.location.origin); }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 sticky top-0 bg-gray-950/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-bold">
              <span className="text-emerald-400">Context</span>Mesh
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400 text-sm">API Reference</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded">v1.0</span>
            <span>Base URL: <code className="text-gray-300 font-mono">{baseUrl}</code></span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex gap-8 px-6 py-8">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 sticky top-20 self-start">
          <div className="space-y-1">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">Endpoints</p>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSection(s.id);
                  document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === s.id
                    ? "bg-emerald-900/20 text-emerald-400"
                    : "text-gray-500 hover:text-white hover:bg-gray-800"
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>

          <div className="mt-8 p-3 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">Auth Header</p>
            <code className="text-[10px] text-emerald-400 font-mono break-all">
              Authorization: Bearer sk_&#123;tenantId&#125;_&#123;32hex&#125;
            </code>
            <p className="text-[10px] text-gray-600 mt-2">
              Get your key from Settings → API Key
            </p>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 space-y-12">
          {/* Intro */}
          <div>
            <h1 className="text-3xl font-bold mb-3">API Reference</h1>
            <p className="text-gray-400 max-w-2xl">
              ContextMesh is a multi-tenant context graph platform. Send events from any system,
              build connected intelligence, and query it via natural language or structured API.
            </p>
            <div className="mt-4 p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <p className="text-xs text-gray-500 mb-2">Quick start — ingest your first event:</p>
              <pre className="text-[11px] text-green-400 font-mono overflow-x-auto">{`curl -X POST ${baseUrl}/api/events \\
  -H "Authorization: Bearer sk_tenant_xxx_abc...def" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_type": "purchase",
    "identifiers": { "email": "user@company.com" },
    "amount": 999
  }'`}</pre>
            </div>
          </div>

          {SECTIONS.map(section => (
            <section key={section.id} id={section.id}>
              <h2 className="text-xl font-bold mb-1">{section.title}</h2>
              <p className="text-sm text-gray-400 mb-5">{section.description}</p>
              <div className="space-y-3">
                {section.endpoints.map((ep, i) => (
                  <EndpointCard key={i} ep={ep} />
                ))}
              </div>
            </section>
          ))}

          {/* SDKs */}
          <section id="sdks">
            <h2 className="text-xl font-bold mb-1">SDKs</h2>
            <p className="text-sm text-gray-400 mb-5">Thin wrappers over the REST API for Python and JavaScript.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3">Python</h3>
                <pre className="text-[11px] text-green-400 font-mono leading-relaxed">{`from contextmesh import ContextMesh

cm = ContextMesh(
  api_key="sk_xxx",
  base_url="${baseUrl}"
)

# Get agent context
context = cm.get_context(phone="9876543210")

# Search
results = cm.search("Gold tier returns")

# Track event
cm.track("purchase",
  identifiers={"email": "u@x.com"},
  amount=999
)

# Get alerts
alerts = cm.get_alerts()`}</pre>
              </div>
              <div className="border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3">JavaScript / TypeScript</h3>
                <pre className="text-[11px] text-green-400 font-mono leading-relaxed">{`import { ContextMesh } from '@contextmesh/sdk';

const cm = new ContextMesh({
  apiKey: 'sk_xxx',
  baseUrl: '${baseUrl}'
});

// Get agent context
const ctx = await cm.getContext({
  phone: '9876543210'
});

// Search
const results = await cm.search(
  'Gold tier returns in Bangalore'
);

// Sync connector
await cm.sync({ type: 'hubspot' });`}</pre>
              </div>
            </div>
          </section>

          {/* MCP */}
          <section id="mcp-config">
            <h2 className="text-xl font-bold mb-1">MCP Configuration</h2>
            <p className="text-sm text-gray-400 mb-5">Connect any MCP-compatible AI agent in one config block.</p>
            <pre className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-[11px] text-green-400 font-mono overflow-x-auto">{`// claude_desktop_config.json or your agent config
{
  "mcpServers": {
    "contextmesh": {
      "url": "${baseUrl}/api/mcp",
      "headers": {
        "Authorization": "Bearer sk_tenant_xxx_abc...def"
      }
    }
  }
}

// Available tools auto-discovered:
// get_context, search, analyze, find_similar,
// track_event, get_alerts, get_commitments`}</pre>
          </section>
        </main>
      </div>
    </div>
  );
}
