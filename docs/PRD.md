# ContextMesh — Product Requirements Document
### The Decision Intelligence Layer for Enterprise

---

## 1. Product Overview

### One-Liner
ContextMesh is a universal context graph platform that captures every interaction, decision, and event across enterprise systems — building a living, queryable graph that makes patterns visible, decisions traceable, and AI agents smarter over time.

### Problem Statement
Enterprise systems today capture **what happened** — a ticket was closed, an order was placed, a return was processed. But the **reasoning behind decisions** disappears into Slack threads, call transcripts, and people's heads.

- Why was a return exception granted on Day 37 when the policy says 30 days?
- What precedent was used? Who approved it? What was the outcome?
- How is this policy *actually* being applied vs. what's written?

No existing system answers these questions. CRMs store customer data. Ticketing systems store tickets. Analytics tools store events. But **none of them capture the connections between decisions, the reasoning behind them, or the patterns that emerge across thousands of similar cases.**

ContextMesh solves this by building a multi-dimensional context graph where every decision trace connects to users, products, policies, agents, and outcomes simultaneously — and any dimension becomes a query entry point.

### Why Now
- $80B in contact center labor costs displaced by AI in 2026 (Gartner), yet 48% of AI deployments fail due to integration/context problems
- AI agents handle routine queries well but fail on exceptions and edge cases because they lack institutional memory
- Existing enterprise tools (Salesforce, Zendesk, SAP) capture outcomes but not reasoning — a structural gap no amount of AI features can fix
- Graph databases (Neo4j) and LLMs (Groq, Claude) are now fast and cheap enough to make real-time decision intelligence practical

---

## 2. Target Users

### Primary: Contact Center / CX Operations
| Role | Pain Point | What ContextMesh Gives Them |
|---|---|---|
| **Support Agent** | Starts every conversation from scratch, no memory of past decisions | Full customer context + similar case precedents before the conversation begins |
| **Team Lead / QA** | Cannot see how decisions are being made across the team | Per-agent decision analytics, consistency scoring, pattern detection |
| **VP Operations** | Policy drift invisible — written rules diverge from actual practice | Policy vs. reality analysis — see how rules are actually applied |
| **Compliance Officer** | Cannot audit WHY decisions were made, only THAT they were | Complete decision audit trail with reasoning, precedent, and outcome |

### Secondary: B2B SaaS Customer Success
| Role | Pain Point | What ContextMesh Gives Them |
|---|---|---|
| **CSM** | Tribal knowledge walks out when team members leave | Institutional memory persists in the graph |
| **RevOps** | Deal exceptions scattered across CRM, Slack, email | Decision precedent graph for pricing/discount patterns |

### Long-Term: Any Enterprise With Decision-Heavy Workflows
Legal, insurance underwriting, procurement, finance — any domain where decisions are precedent-driven, exception-heavy, and poorly documented.

---

## 3. Core Concept: The Context Graph

### Not a Database — A Connected Intelligence Layer

The fundamental insight: **a single decision connects to multiple dimensions simultaneously**. A return exception involves a customer, a product, a policy, an agent, and an outcome. In a traditional database, these live in separate tables. In a context graph, they're nodes connected by edges — and you can enter from any dimension and traverse to any other.

```
                    [Product]
                        |
   [Policy] ———— [Decision Trace] ———— [Outcome]
                        |
              [User] ———+——— [Agent]
```

### One Graph, Multiple Query Paths

| Query Dimension | Entry Point | What It Answers |
|---|---|---|
| **Per-User** | "Show me everything about Priya" | Full history: orders, returns, decisions, commitments, sentiment |
| **Per-Action** | "Show me all late return exceptions" | Patterns across 1000s of similar decisions — approval rates, outcomes, drift |
| **Per-Policy** | "How is Return Policy v3.2 actually applied?" | Written rule vs. actual practice — surfaces undocumented exceptions |
| **Per-Agent** | "How does Agent Ravi compare to the team?" | Decision consistency, exception rates, retention outcomes |
| **Per-Product** | "Show me all decisions about Nike Air Max" | Return rates, common issues, brand escalations |
| **Combination** | "Gold tier COD refunds in Bangalore" | Multi-dimensional traversal — the real power of the graph |

### Node Types

| Node | Key Properties | Example |
|---|---|---|
| **User** | user_id, name, phone, email, tier, city, LTV | Priya M., Gold, Bangalore, LTV: Rs.1.2L |
| **Event** | type, timestamp, status, amount, channel | Return initiated, Day 37, Exception approved |
| **Product** | id, name, category, brand, price | Nike Air Max, Footwear, Rs.8,499 |
| **Session** | id, device, os, channel, location | Mobile, iOS, App, Bangalore |
| **Policy** | name, version, rules, effective_date | Return Policy v3.2, 30-day window |
| **Agent** | id, name, role, team | Ravi K., L2 Support, Returns Team |
| **Outcome** | type, value, follow_up | Customer retained, product resold at 60% |
| **Payment** | method, amount, status | COD, Rs.8,499, Refund pending |

### Edge Types (Relationships)

```
User -[:PERFORMED]-> Event
Event -[:INVOLVES]-> Product
Event -[:PAID_VIA]-> Payment
Event -[:GOVERNED_BY]-> Policy
Event -[:HANDLED_BY]-> Agent
Event -[:RESULTED_IN]-> Outcome
User -[:HAS_SESSION]-> Session
Session -[:CONTAINS]-> Event
Event -[:PRECEDED_BY]-> Event
Event -[:SIMILAR_TO]-> Event
```

---

## 4. Features (Hackathon Scope)

### F1: Universal Smart Search
**The single most important feature.** One search bar that accepts any natural-language query and returns a context graph.

**How it works:**
1. User types a query (e.g., "Gold tier customers who returned Nike products via COD")
2. Groq LLM receives the query + the graph schema
3. LLM generates a Cypher query against Neo4j
4. Results rendered as interactive graph + timeline

**Example queries:**
| Input | What It Does |
|---|---|
| `Priya` | Find user, show full journey graph |
| `9876543210` | Find user by phone number |
| `COD orders above 5000` | Filter by payment method + amount |
| `Gold tier returns in Bangalore` | Multi-dimensional filter |
| `refund pending` | Status-based search |
| `shoes category last 7 days` | Product category + time range |
| `checkout dropoffs` | Behavioral pattern detection |
| `Nike return rate vs Puma` | Comparative analysis |

**Acceptance criteria:**
- Any combination of user attributes, event types, product categories, payment methods, statuses, and time ranges should work
- Response time < 3 seconds including LLM query generation
- Handles ambiguous queries gracefully (LLM asks for clarification or makes best-guess interpretation)

### F2: Interactive Context Graph Visualization
**Every search result renders as an explorable graph, not a table.**

- **Center node** = the primary result of your query
- **Connected nodes** = all related context (users, products, policies, agents, outcomes)
- **Click any node** → it becomes the new center, graph re-expands around it
- **Infinite traversal** — navigate the entire graph by clicking through nodes
- **Color-coded by type** — Users (green), Events (blue/orange/red), Products (purple), Policies (yellow), Agents (teal)
- Zoom, pan, drag nodes to rearrange
- Minimap for orientation in large graphs

**Acceptance criteria:**
- Renders up to 100 nodes without performance degradation
- Node click re-centers and re-queries within 2 seconds
- Side panel shows full details on node click

### F3: Event Timeline View
**Chronological view that complements the graph.** When you search for a category, product, or user — see what happened over time.

- Vertical timeline with event markers
- Each marker shows: event type, count/amount, key details
- Aggregated by day/hour depending on time range
- Pattern annotations (spikes, drops, anomalies)
- Click any timeline point → graph updates to show context around that moment

**Example: Search "shoes"**
```
Apr 1  ── 1,247 product views
Apr 2  ── 342 add to cart
Apr 3  ── 89 purchases (Rs.4.2L)
Apr 4  ── EORS Sale → 3x spike
Apr 5  ── 12 returns initiated (8 size issues)
Apr 6  ── 5 refunds processed (Rs.41K)
```

**Acceptance criteria:**
- Timeline + graph displayed side by side (or toggle)
- Timeline click syncs with graph
- Aggregation adapts to time range (hourly for 1 day, daily for 1 month)

### F4: LLM-Powered Insights with Reasoning Chain
**"Explain this" button on any graph view.** Sends the current graph context to Groq and returns a structured reasoning response — not just a conclusion, but the full chain of **context → reasoning → result**.

This makes every AI insight transparent, auditable, and debuggable. You can see WHY the AI reached a conclusion, what data it used, and where its reasoning might be wrong.

**Response structure (JSON):**
```json
{
  "context": {
    "summary": "Analyzing 5 return events for Nike Air Max across Gold tier users in Bangalore",
    "data_points": [
      "4 of 5 returns cite 'size_runs_small' as reason",
      "3 returns were policy exceptions (Day 31-37, policy allows 30)",
      "Agent Ravi approved all 3 exceptions",
      "4 of 5 customers made another purchase within 60 days",
      "Nike Air Max return rate: 34% vs 22% category average"
    ],
    "graph_scope": "5 Users, 8 Events, 3 Products, 1 Policy, 1 Agent"
  },
  "reasoning": [
    {
      "step": 1,
      "observation": "80% of returns cite sizing as the issue, not product quality",
      "implication": "This is a preventable return — better size guidance could reduce volume"
    },
    {
      "step": 2,
      "observation": "Policy v3.2 says 30 days, but 60% of these returns were approved past that window",
      "implication": "The written policy does not reflect actual practice for Gold tier — creating inconsistency and agent decision overhead"
    },
    {
      "step": 3,
      "observation": "Customers who received exceptions have 80% repeat purchase rate",
      "implication": "Exceptions are driving retention — denying them may save short-term cost but lose long-term LTV"
    }
  ],
  "result": {
    "finding": "Nike Air Max has a systemic sizing problem driving 34% returns. Policy exceptions for Gold tier are effectively standard practice but undocumented.",
    "recommendation": "1) Add size guide to Nike Air Max product page. 2) Formalize Gold tier exception to 45 days — matches reality, reduces agent overhead.",
    "confidence": 0.87,
    "impact": "Estimated 40% reduction in Nike returns, 15% reduction in agent decision time"
  }
}
```

**Use cases for the reasoning chain:**
- **Debugging:** "Why did the AI say return rate is 34%?" → check context.data_points
- **Solutioning:** reasoning steps show the logical chain → identify where to intervene
- **Improvement:** if the AI conclusion seems wrong, you can see exactly which reasoning step was flawed and correct the data or logic
- **Audit trail:** full transparency on what data was used and how conclusions were reached

**Types of analysis:**
- Journey analysis: "This user browsed 12 products, abandoned cart twice, then purchased after EORS discount — price-sensitive pattern"
- Pattern detection: "Nike Air Max has 34% return rate vs 22% category average — 'size runs small' is the dominant reason"
- Policy drift: "Return Policy v3.2 says 30 days, but it's overridden 72% of the time for Gold+ customers"
- Recommendations: "Consider extending return window to 45 days for Gold tier — matches actual behavior and reduces exception overhead"

**Acceptance criteria:**
- Every insight returns the full context → reasoning → result JSON structure
- Insight generated in < 5 seconds (reasoning chain takes slightly longer)
- Contextually relevant to the current graph view
- Reasoning steps are specific (reference actual data points, not vague)
- Actionable result, not just descriptive

### F5: Event Ingestion API
**REST API for pushing events into the graph.**

| Endpoint | Method | Description |
|---|---|---|
| `/api/events` | POST | Ingest a single event |
| `/api/events/batch` | POST | Bulk ingest up to 1000 events |
| `/api/search` | POST | Universal smart search (LLM → Cypher) |
| `/api/users/[id]/events` | GET | Get user's event timeline |
| `/api/schema` | POST | Initialize graph schema/indexes |

**Event payload:**
```json
{
  "event_type": "return_initiated",
  "user_id": "user_priya_001",
  "session_id": "sess_abc123",
  "timestamp": "2026-04-05T14:30:00Z",
  "properties": {
    "product_id": "nike_air_max_001",
    "amount": 8499,
    "reason": "size_runs_small",
    "payment_method": "COD",
    "policy_version": "v3.2",
    "day_since_purchase": 37,
    "exception": true
  },
  "context": {
    "device": "mobile",
    "city": "Bangalore",
    "channel": "app"
  }
}
```

### F6: Retail Demo Dataset
**Pre-seeded with realistic Myntra-style data for the demo.**

- 50-100 synthetic user journeys
- Full lifecycle: app install → browse → cart → checkout → purchase → delivery → return → refund
- Mix of user tiers (Bronze/Silver/Gold/Platinum)
- Mix of cities (Bangalore, Mumbai, Delhi, Chennai, Hyderabad)
- Mix of payment methods (COD, UPI, Credit Card, Debit Card)
- Mix of product categories (Footwear, Apparel, Accessories)
- Realistic patterns embedded (Nike size issues, EORS spike, Gold tier exceptions)
- Policy exception scenarios with agent decisions and outcomes

---

## 5. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | Full-stack in one deploy, serverless API routes |
| **UI** | React 18 + Tailwind CSS | Fast iteration, dark theme, responsive |
| **Graph Visualization** | React Flow | Interactive, draggable node graphs |
| **Graph Database** | Neo4j (Aura free tier) | Purpose-built for multi-dimensional graph queries |
| **LLM** | Groq (llama-3.3-70b-versatile) | Sub-second inference for query generation + insights |
| **Validation** | Zod | Runtime schema validation at API boundary |
| **Language** | TypeScript | End-to-end type safety |
| **Deployment** | Vercel + Neo4j Aura | Zero-config deploy, managed graph database |

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    DASHBOARD                         │
│  ┌────────────────────────────────────────────────┐  │
│  │          Universal Search Bar                  │  │
│  └──────────────────┬─────────────────────────────┘  │
│           ┌─────────┴──────────┐                     │
│           ▼                    ▼                      │
│  ┌─────────────────┐  ┌──────────────────┐          │
│  │  Context Graph  │  │  Event Timeline  │          │
│  │  (React Flow)   │  │  (Chronological) │          │
│  └────────┬────────┘  └────────┬─────────┘          │
│           └─────────┬──────────┘                     │
│                     ▼                                │
│  ┌────────────────────────────────────────────────┐  │
│  │         Detail Panel + LLM Insights            │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
    ┌──────────────┐   ┌──────────────┐
    │   Groq LLM   │   │   Neo4j      │
    │  NL → Cypher  │──▶│   Graph DB   │
    │  + Insights   │   │              │
    └──────────────┘   └──────────────┘
              ▲
              │
    ┌──────────────────┐
    │  Event Ingestion │
    │  API (REST)      │
    └──────────────────┘
```

---

## 6. Data Flow

### Ingestion Flow
```
External App/SDK → POST /api/events → Zod Validation → Neo4j Graph
                                                         │
                                          Creates/links nodes:
                                          User, Event, Product,
                                          Session, Payment, Policy
```

### Query Flow
```
Search Bar → POST /api/search → Groq LLM (schema + query)
                                      │
                                      ▼
                              Cypher Query Generated
                                      │
                                      ▼
                              Neo4j Executes Query
                                      │
                                      ▼
                         Results → React Flow Graph
                                 + Timeline View
                                 + LLM Insight
```

### Exploration Flow
```
Click Node → Node becomes new center → Re-query Neo4j
           → Graph re-expands around new center
           → Timeline updates to show related events
           → Detail panel shows node properties
```

---

## 7. Demo Scenario (Hackathon)

### Setup
- Platform pre-loaded with 50-100 Myntra-style user journeys
- Mix of clean journeys (browse → buy → happy) and exception journeys (returns, refunds, complaints, policy overrides)

### Demo Flow (5 minutes)

**1. "Let me show you what a context graph looks like" (1 min)**
- Search: `"Priya"`
- Full journey graph appears — browse, cart, purchase, return, refund — all connected
- Click on the return node → see it was Day 37, policy says 30 days, exception granted
- Click on the policy → see how it's applied across ALL users (72% override rate)

**2. "Any search works" (1 min)**
- Search: `"COD refunds Bangalore"` → graph shows all matching decision traces
- Search: `"Nike return rate"` → product-level analysis with timeline
- Search: `"Gold tier exceptions last 30 days"` → aggregate pattern

**3. "Timeline tells the story" (1 min)**
- Search: `"shoes category"`
- Timeline shows: views → carts → purchases → EORS spike → returns wave
- Click on the return spike → graph shows the connected reasons (size issues, damaged)

**4. "AI explains the patterns" (1 min)**
- Hit "Analyze" on any graph view
- LLM: "Nike Air Max has 34% return rate driven by sizing issues. 67% of returns cite 'size runs small'. Recommend adding size guide to product page."

**5. "This is the API" (1 min)**
- Show POST /api/events — any app can push events
- Show the graph updating in real-time
- Explain: JS SDK captures this automatically — drop one script tag, events flow, graph builds itself

### Key Talking Points
- "Every existing tool tells you WHAT happened. ContextMesh tells you WHY."
- "One search bar. Any question. Graph + Timeline + AI insights."
- "The graph gets smarter with every interaction. It's a compounding asset."
- "Works for any vertical — retail today, but the same engine serves BFSI, healthcare, SaaS."

---

## 8. Long-Term Vision (Beyond Hackathon)

### Two-Sided Business Model

**Side A — Agent Memory:** Make AI agents smarter by giving them persistent, structured memory from the context graph. Every conversation starts with full context — past decisions, precedents, commitments.

**Side B — Decision Intelligence Dashboard:** Sellable analytics product for enterprises. Decision patterns, policy drift detection, tribal knowledge extraction, compliance audit trails.

### Feature Roadmap

| Phase | Timeline | Features |
|---|---|---|
| **Phase 1** | Months 1-3 | Core graph engine, event ingestion, search, basic dashboard, commitment tracker |
| **Phase 2** | Months 3-6 | Real-time agent copilot, tribal knowledge extractor, MCP/A2A protocol, semantic search |
| **Phase 3** | Months 6-9 | Enterprise product line, compliance modules (HIPAA, SOX, GDPR), vertical templates |
| **Phase 4** | Months 9-12+ | Cross-client benchmarking, decision playbooks, on-premises deployment |

### Revenue Model

| Offering | Target | Pricing |
|---|---|---|
| ContextMesh Voice (agent memory) | Existing voice/chat clients | Per-seat surcharge |
| ContextMesh Intelligence (dashboard) | Upsell to existing clients | Tiered SaaS add-on |
| ContextMesh Enterprise (standalone) | New enterprise clients | $2K-150K+/mo by tier |
| API Access | Developers | Usage-based |

### Competitive Moat
1. **Decision traces are more sensitive and valuable than raw data** — capturing the "why" creates a new category
2. **Graph compounds over time** — more traces = better precedents = smarter agents = higher switching cost
3. **ISO 42001 (AI governance)** — few startups will pursue this in 2026; it signals enterprise-grade trust
4. **No training on client data, ever** — non-negotiable commitment
5. **Multi-dimensional graph** — not a flat database with AI on top, but a purpose-built context layer

---

## 9. Success Metrics

### Hackathon
- [ ] Universal search works with any query combination
- [ ] Graph visualization renders with interactive node exploration
- [ ] Timeline view shows chronological event patterns
- [ ] LLM insights generate actionable analysis
- [ ] 50+ seeded user journeys with realistic patterns
- [ ] Sub-3-second response time on all queries
- [ ] Clean deploy on Vercel + Neo4j Aura

### Post-Hackathon (Phase 1)
| Metric | Target |
|---|---|
| Traces captured / day / client | 100+ |
| Search query → result time | < 3 seconds |
| Precedent retrieval accuracy | 70%+ |
| Agent resolution time improvement | 15%+ |
| Escalation reduction | 10%+ |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| LLM generates invalid Cypher queries | Search fails | Validate Cypher before execution; fallback to structured search |
| Neo4j Aura free tier rate limits | Demo breaks under load | Pre-cache common demo queries; keep dataset manageable |
| Graph becomes too dense to visualize | UI confusion | Limit visible nodes to 50-100; progressive disclosure on click |
| Groq API latency spike | Slow demo | Cache LLM responses for demo queries; have pre-generated insights ready |
| Judges unfamiliar with graph databases | Miss the point | Lead with the search experience, not the tech. "Type anything, get answers." |
