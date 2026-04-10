# ContextMesh

**Universal Event Tracking Context Graph**

Capture every user interaction across any system. Build a living connected graph. Make patterns visible, queryable, and actionable for AI agents.

Built by **Latency Labs** for Nurix Hackathon 2025.

---

## What it does

ContextMesh ingests events from any source — APIs, CRMs, webhooks, raw JSON — resolves them into unified profiles, and builds a Neo4j graph connecting every user action. The graph is searchable in plain English, visualized interactively, and exposed to AI agents via a context API.

**Two verticals out of the box:** Retail (Myntra-style) and Healthcare (Hospital).

---

## Architecture

```
[Any Data Source]
      │
      ▼
[Ingest Layer]  ←── REST API / JS SDK / Python SDK / Connectors / Raw JSON
      │
      ▼
[Identity Resolver]  ←── 3-tier deterministic merge (email + phone + crm_id)
      │
      ▼
[Neo4j Graph]  ←── Profile → Events → Products / Policies / Providers
      │
      ├── Search API (NL → Cypher via LLM)
      ├── Insights API (LLM reasoning over graph)
      ├── Agent Context API (MCP + REST)
      ├── Alert Engine (churn, drift, anomaly, readmission)
      └── Webhook Push (to any CRM)
```

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Graph DB | Neo4j Aura |
| Queue | Redis Streams (Upstash) |
| LLM | Groq (llama-3.3-70b) / Anthropic Claude |
| Visualization | React Flow |
| Auth | NextAuth.js (Google + credentials) |
| App DB | Prisma + SQLite |
| Language | TypeScript |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Neo4j Aura account (free tier works)
- Upstash Redis (optional — falls back to direct processing)
- Groq API key (or Anthropic)

### Install

```bash
git clone https://github.com/Vidhi2604/context-graph.git
cd context-graph
npm install
```

### Environment

Create `.env.local`:

```env
# Neo4j
NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# Auth
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000

# LLM
GROQ_API_KEY=gsk_...
# or
ANTHROPIC_API_KEY=sk-ant-...

# Redis Streams (optional)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Connectors (optional)
NURIX_API_URL=https://...
NURIX_API_KEY=...
NURIX_AGENT_ID=...
NURIX_WORKSPACE_ID=...
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed Data

```bash
# Seed retail vertical (200 profiles, 8 journey types)
curl -X POST http://localhost:3000/api/ingest/retail \
  -H "Content-Type: application/json" \
  -d '{"seed": true}'

# Seed healthcare vertical (200 patients, 12 journey types)
curl -X POST http://localhost:3000/api/ingest/healthcare \
  -H "Content-Type: application/json" \
  -d '{"seed": true}'
```

---

## Features

### Event Ingestion

**REST API**
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer cm_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "purchase",
    "identifiers": { "email": "user@example.com", "phone": "+91-9876543210" },
    "properties": { "amount": 1499, "product_id": "PROD_001" }
  }'
```

**Raw ingest (any JSON format)**
```bash
curl -X POST "http://localhost:3000/api/ingest/raw?client=myntra" \
  -H "Authorization: Bearer cm_live_..." \
  -d '{ "user_id": "u123", "action": "BUY", "price": 1499 }'
```

**Batch**
```bash
curl -X POST http://localhost:3000/api/events/batch \
  -H "Authorization: Bearer cm_live_..." \
  -d '{ "events": [...] }'
```

### JavaScript / TypeScript SDK

```typescript
import { ContextMesh } from "@/sdk/js";

const cm = new ContextMesh({ apiKey: "cm_live_...", baseUrl: "http://localhost:3000" });

// Track events
await cm.track({ email: "user@example.com", event: "purchase", properties: { amount: 1499 } });

// Search the graph
const { nodes, edges, insights } = await cm.search({ query: "high value customers who churned" });

// Get agent context
const ctx = await cm.getAgentContext({ email: "user@example.com" });
console.log(ctx.context_summary);
```

**Browser auto-capture**
```typescript
import { ContextMeshBrowser } from "@/sdk/js";

const cm = new ContextMeshBrowser({ apiKey: "cm_live_..." });
cm.identify({ email: "user@example.com" }); // links session to profile
// page_view events fire automatically on load + SPA navigation
```

### Python SDK

```python
from src.sdk.python.contextmesh import ContextMesh

cm = ContextMesh(api_key="cm_live_...", base_url="http://localhost:3000")

# Track
cm.track("purchase", email="user@example.com", properties={"amount": 1499})

# Agent context
ctx = cm.get_agent_context(email="user@example.com")
print(ctx["context_summary"])

# LangChain tool
from src.sdk.python.contextmesh import ContextMeshTool
tool = ContextMeshTool(cm)
result = tool.run('{"email": "user@example.com"}')
```

### Connectors (pull mode)

Sync data from external CRMs on demand:

| Connector | Auth | Status |
|---|---|---|
| HubSpot | OAuth access_token | ✅ |
| Zendesk | API key + subdomain | ✅ |
| Salesforce | OAuth + instance_url | ✅ |
| Zoho CRM | OAuth access_token | ✅ |
| Nurix AgentX | API key | ✅ |
| Custom | Any webhook | ✅ |

```bash
# Sync a connector
curl -X POST http://localhost:3000/api/connectors/sync \
  -H "Authorization: Bearer cm_live_..." \
  -d '{ "type": "hubspot", "credentials": { "access_token": "..." }, "since": "2025-01-01" }'
```

Configure connectors at [/settings](http://localhost:3000/settings).

### Webhooks (push mode)

Push intelligence back to any system when alerts fire:

```bash
# Register a webhook
curl -X POST http://localhost:3000/api/connectors \
  -d '{
    "type": "webhook",
    "url": "https://hooks.zapier.com/...",
    "events": ["churn_risk", "policy_drift", "anomaly_spike"]
  }'
```

### Agent Context API

One call returns everything an AI agent needs to handle a customer:

```bash
curl -X POST http://localhost:3000/api/agent/context \
  -H "Authorization: Bearer cm_live_..." \
  -d '{ "email": "user@example.com" }'
```

```json
{
  "profile": { "name": "Priya Sharma", "tier": "Gold", "city": "Mumbai" },
  "recent_events": [...],
  "insights": "High-value customer with 3 unresolved support tickets...",
  "alerts": [{ "type": "churn_risk", "score": 0.82 }],
  "context_summary": "Priya is a Gold tier customer who purchased ₹12,400 in the last 30 days..."
}
```

### MCP Server

Use ContextMesh as an MCP tool in Claude or any MCP-compatible agent:

```json
{
  "mcpServers": {
    "contextmesh": {
      "command": "node",
      "args": ["path/to/mcp-server.js"],
      "env": {
        "CONTEXTMESH_API_KEY": "cm_live_...",
        "CONTEXTMESH_BASE_URL": "https://your-deployment.com"
      }
    }
  }
}
```

### Search

Natural language search over the graph:

```
"customers who abandoned cart after viewing premium products"
"patients with readmission risk in cardiology"
"high value users who filed support tickets last week"
```

Returns: graph nodes + edges + LLM-generated insights + event timeline.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── dashboard/                  # Main dashboard + sub-pages
│   ├── settings/                   # Connectors + webhooks config
│   ├── api-docs/                   # Full API documentation
│   ├── logo-concepts/              # Logo concepts (10 options)
│   └── api/
│       ├── events/                 # Ingest, batch, process, transcript
│       ├── search/                 # NL search + similar profiles
│       ├── agent/context/          # Agent context API
│       ├── insights/               # LLM insights
│       ├── connectors/             # Connector CRUD + sync
│       ├── alerts/                 # Alert engine
│       ├── profiles/               # Profile lookup
│       ├── stats/                  # Graph statistics
│       ├── streams/                # Redis Streams consumer
│       ├── ingest/                 # Raw ingest + source-specific
│       ├── mcp/                    # MCP server endpoint
│       └── auth/                   # NextAuth + org switch
├── components/
│   ├── ContextGraph.tsx            # React Flow graph (radial layout)
│   ├── ContextTimeline.tsx         # Event timeline (person + aggregate)
│   ├── Logo.tsx                    # Orbital Nodes logo
│   ├── InsightPanel.tsx            # LLM insight display
│   ├── FilterBar.tsx               # Multi-select filters
│   ├── TracePanel.tsx              # Pipeline debug trace
│   ├── NodeDetail.tsx              # Graph node detail panel
│   └── OrgSwitcher.tsx             # Multi-tenant org switcher
├── lib/
│   ├── neo4j.ts                    # Neo4j driver
│   ├── identity-resolver.ts        # 3-tier identity merge
│   ├── graph-mapper.ts             # Neo4j → React Flow mapper
│   ├── llm.ts                      # Unified LLM interface
│   ├── streams.ts                  # Redis Streams (XADD/XREAD)
│   ├── alert-engine.ts             # Churn, drift, anomaly detection
│   ├── raw-mapper.ts               # Any JSON → ContextMesh schema
│   ├── redact.ts                   # PHI/PII scrubber
│   ├── connectors/                 # HubSpot, Zendesk, Salesforce, Zoho, Nurix
│   └── ingest-configs/             # Per-client field mappings
├── verticals/
│   ├── retail/                     # Myntra-style schema + 200-profile seed
│   └── healthcare/                 # Hospital schema + 200-patient seed
├── sdk/
│   ├── js/index.ts                 # JS/TS SDK
│   └── python/contextmesh.py       # Python SDK
├── types/                          # TypeScript types
└── fixtures/                       # Nurix sample call transcripts
```

---

## Verticals

### Retail
- **Profiles**: name, tier (Bronze/Silver/Gold/Platinum), city, age
- **Events**: page_view, product_view, add_to_cart, purchase, return, support_ticket, review
- **Nodes**: Product, Policy (versioned), Agent, Payment, Commitment
- **Journey types**: happy_path, cart_abandon, return_loop, support_heavy, repeat_buyer, churned, seasonal, browse_only

### Healthcare
- **Profiles**: patient demographics, insurance
- **Visits**: Emergency, Inpatient, Outpatient, Follow-up, Surgery
- **Nodes**: Diagnosis (ICD-10), Treatment, Provider, Protocol, Medication, InsuranceClaim
- **Journey types**: chronic_disease, surgical, emergency, preventive, mental_health, pediatric, oncology, and more

---

## Identity Resolution

Three-tier deterministic merge:

1. **Deterministic** — exact match on email, phone, or crm_id → merge into same Profile
2. **Enrich** — update existing Profile with new identifiers from same event
3. **Tombstone merge** — when two previously separate Profiles are found to be the same person

All events from HubSpot, Zendesk, Nurix calls, and direct API are resolved into one unified Profile node.

---

## Alerts

Automatically triggered when patterns are detected:

| Alert | Trigger |
|---|---|
| `churn_risk` | High-value customer goes quiet / files ticket |
| `policy_drift` | Customer behaviour deviates from policy commitment |
| `commitment_breach` | Committed SLA not honoured |
| `anomaly_spike` | Event volume spikes > 1.5× average |
| `readmission_risk` | Patient readmitted within 30 days (healthcare) |

Alerts fire webhooks to configured URLs.

---

## API Reference

Full interactive API docs available at [/api-docs](http://localhost:3000/api-docs).

Key endpoints:

| Method | Path | Description |
|---|---|---|
| POST | `/api/events` | Ingest a single event |
| POST | `/api/events/batch` | Ingest up to 1000 events |
| POST | `/api/ingest/raw` | Ingest any JSON format |
| POST | `/api/search` | NL search → graph + insights |
| POST | `/api/agent/context` | Full customer context for AI agents |
| GET | `/api/profiles/:id` | Get profile by ID |
| GET | `/api/stats` | Graph statistics |
| POST | `/api/connectors/sync` | Sync a connector |
| POST | `/api/alerts` | Trigger alert evaluation |
| GET | `/api/mcp` | MCP server endpoint |

---

## License

MIT — Built for Nurix Hackathon 2025 by Latency Labs.
# Deployment ready
# Ready for deployment
# Deployment triggered
# Deployment triggered
# test
# test
# ready
# deployment ready
# deploy
# deploy
# v1
# v2
# ready to deploy
# v4
# v5
