# ContextMesh — Product Requirements Document
### The Decision Intelligence Layer for Enterprise

---

## 1. Product Overview

### One-Liner
ContextMesh is a multi-tenant, multi-vertical context graph platform that captures every interaction, decision, and event — building a living, queryable graph that makes patterns visible, decisions traceable, and AI agents smarter over time.

### Problem Statement
Enterprise systems capture **what happened** — a ticket was closed, a return was processed, a patient was discharged. But the **reasoning behind decisions** disappears into Slack threads, call transcripts, and people's heads.

**In Retail:**
- Why was a return exception granted on Day 37 when the policy says 30 days?
- Which products have systemic issues hiding behind exception approvals?

**In Healthcare:**
- Why was this patient readmitted within 30 days?
- Why did Dr. Sharma deviate from the standard protocol for this cardiac case?
- Which insurance claims keep getting denied, and what's the pattern?

No existing system answers these questions across verticals. ContextMesh solves this by building a multi-dimensional context graph where every decision trace connects to people, entities, policies, agents, and outcomes simultaneously — and any dimension becomes a query entry point.

### Why Now
- $80B in contact center labor costs displaced by AI in 2026 (Gartner), yet 48% of AI deployments fail due to integration/context problems
- Hospital readmission penalties cost $500M+/year in US Medicare alone — and root causes are invisible in current EHR systems
- AI agents handle routine queries but fail on exceptions because they lack institutional memory
- Graph databases (Neo4j) and LLMs (Claude Haiku + Sonnet) are now fast and cheap enough to make near-near-real-time decision intelligence (<6s end-to-end) practical (events queryable within 6 seconds of ingestion)

---

## 2. Platform Architecture

### Multi-Vertical, Multi-Tenant SaaS

```
┌──────────────────────────────────────────────────────────────┐
│                     CONTEXTMESH PLATFORM                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │           AGENT INTEGRATION LAYER                     │    │
│  │                                                       │    │
│  │  ┌──────────────┐ ┌────────────┐ ┌───────────────┐  │    │
│  │  │  MCP Server  │ │  REST API  │ │  Python / JS  │  │    │
│  │  │  (AI agents  │ │  (bots,    │ │  SDK          │  │    │
│  │  │  auto-       │ │  backends, │ │  (1-line      │  │    │
│  │  │  discover)   │ │  webhooks) │ │  setup)       │  │    │
│  │  └──────┬───────┘ └─────┬──────┘ └──────┬────────┘  │    │
│  │         └───────────────┼───────────────┘            │    │
│  │                         ▼                             │    │
│  │              API Key Auth · Tenant Scoping            │    │
│  └─────────────────────────┬────────────────────────────┘    │
│                            ▼                                  │
│  ┌─────────────┐   ┌────────────────┐                        │
│  │  Auth +      │   │  Plan Gating   │                        │
│  │  Onboarding  │   │  (Starter/Pro/ │                        │
│  │              │   │   Enterprise)  │                        │
│  └──────┬──────┘   └───────┬────────┘                        │
│         └─────────┬────────┘                                  │
│                   ▼                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              SHARED CORE ENGINE                         │  │
│  │                                                         │  │
│  │  Kafka Pipeline · Identity Resolution · Neo4j Graph     │  │
│  │  Vector Search · Graph Algorithms · Claude LLM (Haiku + Sonnet)            │  │
│  │  Transcript Extraction · Relevance Scoring              │  │
│  │  Commitment Tracker · Alert Engine                      │  │
│  └──────────────┬──────────────────┬──────────────────────┘  │
│                 │                  │                           │
│     ┌───────────┴──────┐  ┌───────┴────────────┐             │
│     ▼                  ▼  ▼                    ▼              │
│  ┌──────────────┐  ┌──────────────────────────────┐          │
│  │  SIDE A       │  │  SIDE B                      │          │
│  │  Agent Memory │  │  Intelligence Dashboard      │          │
│  │               │  │                              │          │
│  │  /agent/      │  │  /dashboard (search+graph)   │          │
│  │   context     │  │  /dashboard/analytics        │          │
│  │  /mcp         │  │  /dashboard/policies         │          │
│  │  /events      │  │  /dashboard/agents           │          │
│  │  /events/     │  │  /dashboard/commitments      │          │
│  │   transcript  │  │  /alerts · /stats            │          │
│  └──────────────┘  └──────────────────────────────┘          │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              VERTICAL SCHEMAS                           │  │
│  │                                                         │  │
│  │  ┌─────────────────┐       ┌──────────────────────┐    │  │
│  │  │  RETAIL          │       │  HEALTHCARE           │    │  │
│  │  │  Profile,        │       │  Profile,             │    │  │
│  │  │  Identity,       │       │  Identity,            │    │  │
│  │  │  Event, Product, │       │  Visit, Diagnosis,    │    │  │
│  │  │  Payment, Policy,│       │  Treatment, Provider, │    │  │
│  │  │  Agent, Outcome  │       │  Claim, Protocol,     │    │  │
│  │  │  Demo: Myntra    │       │  Medication, Outcome  │    │  │
│  │  └─────────────────┘       └──────────────────────┘    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

Each tenant (organization) gets:
- Isolated graph namespace in Neo4j
- Their own vertical schema (retail or healthcare)
- Plan-based feature access

---

## 3. Target Users

### Retail Vertical
| Role | Pain Point | What ContextMesh Gives Them |
|---|---|---|
| **Support Agent** | Starts every conversation from scratch | Full customer context + decision precedents |
| **Team Lead / QA** | Cannot see how decisions are made across the team | Per-agent analytics, consistency scoring |
| **VP Operations** | Policy drift invisible | Policy vs. reality analysis |
| **Compliance Officer** | Cannot audit WHY decisions were made | Complete decision audit trail with reasoning |

### Healthcare Vertical
| Role | Pain Point | What ContextMesh Gives Them |
|---|---|---|
| **Doctor / Provider** | No visibility into treatment patterns and outcomes across patients | Full patient journey graph, treatment outcome analysis |
| **Hospital Administrator** | Readmission causes invisible, protocol deviations undocumented | Readmission pattern detection, protocol drift analysis |
| **Insurance / Billing** | Claim denials are precedent-driven but precedents aren't tracked | Claim denial graph — see patterns, similar approved cases |
| **Quality Officer** | Clinical protocol compliance tracked manually | Protocol adherence vs. reality, deviation patterns |
| **Department Head** | No cross-department view of patient journey | Connected graph across ER → ICU → Ward → Discharge → Follow-up |

---

## 4. Core Concept: The Context Graph

### One Engine, Two Schemas

The fundamental insight: **a single decision connects to multiple dimensions simultaneously**. In retail, a return exception connects to a customer, product, policy, agent, and outcome. In healthcare, a treatment decision connects to a patient, diagnosis, protocol, provider, and outcome. Same graph structure. Different domain vocabulary.

### Identity Resolution — The Foundation

The same person appears differently across sources (web SDK, app SDK, CRM, support calls, hospital systems). Without identity resolution, the graph fragments — you get 5 disconnected nodes for 1 person.

ContextMesh solves this with a **Profile + Identity** architecture:

```
                        ┌──────────────────┐
                        │     PROFILE      │
                        │   (canonical)    │
                        │                  │
                        │   name, tier,    │
                        │   city, ltv...   │
                        └────────┬─────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
         [:HAS_IDENTITY]   [:HAS_IDENTITY]   [:HAS_IDENTITY]
              │                  │                  │
              ▼                  ▼                  ▼
        ┌───────────┐    ┌───────────┐    ┌───────────┐
        │ email     │    │ phone     │    │ device_id │
        │ priya@    │    │ 987654   │    │ dev_xyz   │
        │ gmail.com │    │ 3210     │    │           │
        └───────────┘    └───────────┘    └───────────┘
```

**Profile** = the unified person. One per real human. Holds enriched attributes (name, tier, city, etc.)
**Identity** = any identifier that points to them. Many per person (email, phone, device, cookie, MRN, Aadhaar, CRM ID, etc.)

**Resolution rules:**
1. Event arrives with identifiers (email, phone, device_id, cookie, etc.)
2. Look up each identifier → does it match an existing Profile?
3. If multiple identifiers match different Profiles → merge them (same person discovered)
4. If no match → create new Profile
5. Link the event to the resolved Profile

**Priority hierarchy:**
- **Strong (deterministic):** email, phone, MRN, CRM ID, Aadhaar → unique per person, auto-merge
- **Medium:** device_id, name + city combo → likely match, merge if paired with a strong ID
- **Weak (temporary):** cookie_id, session_id, IP → keep separate until a strong link appears

This works identically across verticals — retail has cookies + emails + phones, healthcare has MRNs + Aadhaar + insurance IDs. The resolution engine is shared.

**Production roadmap:** Identity resolution scales to 4 tiers — deterministic (current), probabilistic (Fellegi-Sunter/Splink for fuzzy matching), graph-walk (traverse shared edges in Neo4j to infer identity), and LLM-assisted (for ambiguous cases like "the woman from Acme" in a transcript). Hackathon = tier 1 (deterministic). Tiers 2-4 are additive.

### Shared Node Types (Both Verticals)

| Node | Purpose | Key Properties |
|---|---|---|
| **Profile** | Canonical person (user/patient) | profile_id, name, type (user/patient), vertical-specific attributes |
| **Identity** | Any identifier for a person | type (email/phone/device/cookie/mrn/aadhaar), value, source, verified, first_seen |

### Retail Node Types

| Node | Key Properties | Example |
|---|---|---|
| **Profile** | profile_id, name, tier, city, ltv | Priya M., Gold, Bangalore, LTV: Rs.1.2L |
| **Identity** | type, value, source, verified | email, priya@gmail.com, app_sdk, true |
| **Event** | type, timestamp, status, amount, channel, confidence_score | Return initiated, Day 37, Exception approved, 0.87 |
| **Product** | id, name, category, brand, price | Nike Air Max, Footwear, Rs.8,499 |
| **Session** | id, device, os, channel, location | Mobile, iOS, App, Bangalore |
| **Policy** | name, version, rules, effective_date, status | Return Policy v3.2, 30-day window, active |
| **Agent** | id, name, role, team | Ravi K., L2 Support, Returns Team |
| **Outcome** | type, value, follow_up | Customer retained, product resold at 60% |
| **Payment** | method, amount, status | COD, Rs.8,499, Refund pending |
| **Commitment** | promise_text, deadline, status, assignee | "Refund within 48h", Apr 7, breached, Ravi K. |

### Healthcare Node Types

| Node | Key Properties | Example |
|---|---|---|
| **Profile** | profile_id, name, age, gender, blood_group, city, insurance_provider | Amit K., 58, Male, B+, Mumbai, Star Health |
| **Identity** | type, value, source, verified | mrn, MH-4829, hospital_ehr, true |
| **Visit** | visit_id, type, timestamp, department, status, priority, confidence_score | Emergency, Apr 3, Cardiology, Discharged, Critical, 0.91 |
| **Diagnosis** | diagnosis_id, code (ICD-10), name, severity, chronic | I21.0, Acute MI, Critical, No |
| **Treatment** | treatment_id, name, type, cost, duration | Angioplasty, Procedure, Rs.2.5L, 3 hours |
| **Medication** | medication_id, name, dosage, frequency, duration | Metformin 500mg, Twice daily, 90 days |
| **Provider** | provider_id, name, specialization, department, experience_years | Dr. Sharma, Cardiologist, Cardiology, 15 years |
| **InsuranceClaim** | claim_id, amount, status, denial_reason, payer | CLM-4829, Rs.2.5L, Denied, Pre-auth missing, Star Health |
| **Protocol** | protocol_id, name, version, condition, standard_treatment, status | Acute MI Protocol v2.1, STEMI, Primary PCI within 90 min, active |
| **Outcome** | outcome_id, type, readmission, days_to_readmission, mortality | Discharged, Readmitted, 18 days |
| **Department** | department_id, name, type | Cardiology, Clinical |
| **Commitment** | promise_text, deadline, status, assignee | "Follow-up angiogram in 2 weeks", Mar 29, breached, Dr. Sharma |

### Retail Relationships

```
Profile -[:HAS_IDENTITY]-> Identity
Profile -[:PERFORMED]-> Event
Profile -[:HAS_SESSION]-> Session
Event -[:NEXT]-> Event
Event -[:INVOLVES]-> Product
Event -[:PAID_VIA]-> Payment
Event -[:GOVERNED_BY]-> Policy
Event -[:OVERRODE]-> Policy
Event -[:HANDLED_BY]-> Agent
Event -[:RESULTED_IN]-> Outcome
Event -[:CREATED_COMMITMENT]-> Commitment
Session -[:CONTAINS]-> Event
Profile -[:HAS_COMMITMENT]-> Commitment
Policy -[:SUPERSEDED_BY]-> Policy
```

### Healthcare Relationships

```
Profile -[:HAS_IDENTITY]-> Identity
Profile -[:HAD_VISIT]-> Visit
Profile -[:READMITTED]-> Visit
Visit -[:DIAGNOSED_WITH]-> Diagnosis
Visit -[:TREATED_WITH]-> Treatment
Visit -[:PRESCRIBED]-> Medication
Visit -[:ATTENDED_BY]-> Provider
Visit -[:GOVERNED_BY]-> Protocol
Visit -[:DEVIATED_FROM]-> Protocol
Visit -[:RESULTED_IN]-> Outcome
Visit -[:CLAIMED_VIA]-> InsuranceClaim
Visit -[:IN_DEPARTMENT]-> Department
Visit -[:CREATED_COMMITMENT]-> Commitment
Visit -[:NEXT]-> Visit
Diagnosis -[:INDICATES]-> Treatment
Treatment -[:USES]-> Medication
Provider -[:BELONGS_TO]-> Department
Profile -[:HAS_COMMITMENT]-> Commitment
Protocol -[:SUPERSEDED_BY]-> Protocol
```

### How Search Finds People

Any identifier resolves to the same Profile:

```
Search: "9876543210"
  → MATCH (i:Identity {value: "9876543210"})<-[:HAS_IDENTITY]-(p:Profile)
  → Returns Priya's full graph

Search: "priya@gmail.com"
  → MATCH (i:Identity {value: "priya@gmail.com"})<-[:HAS_IDENTITY]-(p:Profile)
  → Returns same Priya, same graph

Search: "Priya"
  → MATCH (p:Profile) WHERE p.name CONTAINS "Priya"
  → Returns same Priya, same graph
```

Doesn't matter which identifier you search by — you always land on the unified Profile.

---

## 5. Features

### F1: Auth + Onboarding
**Sign up → pick vertical → land in your dashboard.**

- Sign in with Google or email/password (NextAuth.js)
- Onboarding flow: org name → select vertical (Retail / Healthcare) → auto-provisions graph schema
- Each org gets a tenant_id scoped to all their data
- Invite team members (email invite, same org)

### F2: Subscription Plans (Feature-Gated)

| Feature | Starter (Free) | Pro | Enterprise |
|---|---|---|---|
| Events / month | 1,000 | 10,000 | Unlimited |
| Universal search | Basic (text match) | Full (LLM → Cypher) | Full |
| Context graph viz | Up to 25 nodes | Up to 100 nodes | Unlimited |
| Timeline view | Last 7 days | Last 90 days | Unlimited |
| LLM insights | Not available | Summary only | Full reasoning chain |
| API access | Not available | REST API | Full REST + MCP + SDK |
| Audit trail export | Not available | Not available | Full compliance export (SOX/HIPAA) |
| PII redaction | Not available | Basic (masking) | Full (Presidio, custom recognizers) |
| Team members | 1 | 5 | Unlimited |
| Seed demo data | Included | Included | Custom import + historical backfill |

No payment integration for now — plan selector in settings, features gated by plan flag on the org.

### F3: Universal Smart Search
**One search bar, any query, any vertical.** LLM translates natural language to Cypher against the org's graph.

**Retail example queries:**
| Input | What It Does |
|---|---|
| `Priya` | Find user, show full journey graph |
| `9876543210` | Find user by phone number |
| `COD orders above 5000` | Payment method + amount filter |
| `Gold tier returns in Bangalore` | Multi-dimensional filter |
| `shoes category last 7 days` | Product category + time range |
| `Nike return rate vs Puma` | Comparative analysis |

**Healthcare example queries:**
| Input | What It Does |
|---|---|
| `Amit Kumar` | Find patient, show full visit history |
| `readmissions within 30 days` | Readmission pattern across all patients |
| `Dr. Sharma cardiac patients` | Provider-specific treatment patterns |
| `insurance denials for knee replacement` | Claim denial analysis |
| `diabetic patients on insulin` | Medication + diagnosis filter |
| `protocol deviations in ICU last month` | Compliance analysis |
| `ER wait time > 2 hours` | Operational metric filter |
| `STEMI outcomes by provider` | Condition + provider comparative |

**Acceptance criteria:**
- Works across both verticals — LLM receives the correct schema based on org's vertical
- Any combination of dimensions works
- Response time < 3 seconds
- Handles ambiguous queries gracefully

### F4: Interactive Context Graph Visualization
**Every search result renders as an explorable graph.**

- Center node = primary result of query
- Connected nodes = all related context
- Click any node → it becomes new center, graph re-expands
- Color-coded by node type (consistent within vertical)
- Zoom, pan, drag, minimap
- Side panel shows full details on click
- **Nodes sized proportionally to relevance score** — high-relevance nodes are larger, low-relevance nodes are dimmed
- **Confidence badge** on extracted event/visit nodes shows extraction confidence (0.87, 0.92, etc.)

**Retail colors:** User (green), Event (blue), Product (purple), Policy (yellow), Agent (teal), Payment (orange), Outcome (red), Commitment (pink)

**Healthcare colors:** Patient (green), Visit (blue), Diagnosis (red), Treatment (purple), Medication (cyan), Provider (teal), InsuranceClaim (orange), Protocol (yellow), Outcome (pink), Department (indigo), Commitment (lime)

### F5: Event Timeline View
**Chronological view that complements the graph.**

- **Sort toggle:** "Sort by time" vs "Sort by relevance"
- **Filter:** "Show only high-relevance events (>0.7)" toggle
- Each event shows its confidence score as a subtle badge

**Retail example: Search "shoes"**
```
Apr 1  ── 1,247 product views
Apr 2  ── 342 add to cart
Apr 3  ── 89 purchases (Rs.4.2L)
Apr 4  ── EORS Sale → 3x spike
Apr 5  ── 12 returns initiated (8 size issues)
```

**Healthcare example: Search "Patient Amit Kumar"**
```
Mar 15 ── ER Visit: Chest pain, Cardiology [confidence: 0.95]
Mar 15 ── Diagnosis: Acute MI (STEMI) [confidence: 0.93]
Mar 15 ── Treatment: Primary PCI / Angioplasty [confidence: 0.91]
Mar 16 ── ICU → Ward transfer [confidence: 0.97]
Mar 20 ── Discharge, medications prescribed [confidence: 0.89]
Mar 29 ── ⚠ Commitment breached: Follow-up angiogram not scheduled [confidence: 0.94]
Apr 02 ── Readmission: Chest pain recurrence
Apr 02 ── Diagnosis: Post-PCI restenosis [confidence: 0.88]
```

**Healthcare example: Search "cardiology department"**
```
Mar W1 ── 45 visits, 12 procedures, 2 readmissions
Mar W2 ── 52 visits, 15 procedures, 4 readmissions ⚠ spike
Mar W3 ── 48 visits, 11 procedures, 1 readmission
Mar W4 ── 50 visits, 14 procedures, 3 readmissions
```

### F6: LLM-Powered Insights with Reasoning Chain
**"Explain this" button on any graph view.** Returns structured **context → reasoning → result** JSON.

**Retail example response:**
```json
{
  "context": {
    "summary": "Analyzing 5 return events for Nike Air Max across Gold tier users",
    "data_points": ["4 of 5 returns cite 'size_runs_small'", "..."]
  },
  "reasoning": [
    { "step": 1, "observation": "80% cite sizing issue", "implication": "Preventable return", "confidence": 0.92 },
    { "step": 2, "observation": "Policy overridden 60% of time", "implication": "Policy drift", "confidence": 0.88 }
  ],
  "result": {
    "finding": "Nike Air Max has systemic sizing problem driving 34% returns",
    "recommendation": "Add size guide + formalize Gold tier 45-day window",
    "confidence": 0.87
  }
}
```

**Healthcare example response:**
```json
{
  "context": {
    "summary": "Analyzing 18-day readmission for Patient Amit Kumar, post-angioplasty",
    "data_points": [
      "Patient had STEMI, treated with primary PCI on Mar 15",
      "Discharged Mar 20 with dual antiplatelet therapy",
      "Readmitted Apr 2 with chest pain — diagnosed with in-stent restenosis",
      "Dr. Sharma performed both procedures",
      "3 other patients with same stent type readmitted within 30 days",
      "Protocol v2.1 recommends follow-up angiogram at 2 weeks — not scheduled"
    ]
  },
  "reasoning": [
    {
      "step": 1,
      "observation": "Readmission within 18 days post-PCI with same symptom profile",
      "implication": "Possible procedural complication or inadequate post-discharge follow-up",
      "confidence": 0.91
    },
    {
      "step": 2,
      "observation": "Protocol v2.1 mandates 2-week follow-up angiogram; none was scheduled",
      "implication": "Protocol deviation — early detection of restenosis was missed",
      "confidence": 0.94
    },
    {
      "step": 3,
      "observation": "3 other patients with same DES stent type had similar restenosis",
      "implication": "Possible stent batch/type issue — not isolated to this patient",
      "confidence": 0.73
    }
  ],
  "result": {
    "finding": "Readmission linked to missed follow-up angiogram (protocol deviation) and potential stent quality issue affecting 4 patients",
    "recommendation": "1) Enforce automated follow-up scheduling per Protocol v2.1. 2) Audit DES stent batch used in Mar procedures. 3) Flag 3 other affected patients for proactive follow-up.",
    "confidence": 0.82,
    "impact": "Could prevent 3 additional readmissions, saving ~Rs.7.5L in treatment costs + avoiding Medicare penalty"
  }
}
```

**Use cases for reasoning chain:**
- **Debugging:** Why did the AI flag this readmission? → check context.data_points
- **Clinical audit:** Was the protocol followed? → reasoning step 2 shows the deviation
- **Quality improvement:** Is this a one-off or systemic? → reasoning step 3 identifies pattern
- **Cost analysis:** What's the financial impact? → result.impact quantifies it

### F7: Event Ingestion API
**REST API for pushing events into the graph. Three front doors — same Kafka pipeline behind all of them.**

```
 Structured Events          Transcript (STT)           Batch Import
 (Web SDK, CRM,             (Voice calls,              (Historical
  App, Webhooks)             Doctor notes)              backfill)
       │                         │                         │
       ▼                         ▼                         ▼
  POST /api/events      POST /api/events/        POST /api/events/batch
                              transcript
       │                         │                         │
       │                    Claude Haiku extracts           │
       │                    structured events               │
       │                         │                         │
       └─────────────────────────┼─────────────────────────┘
                                 │
                                 ▼
                          Upstash Kafka
                          (events-{tenantId})
                                 │
                                 ▼
                          Consumer Pipeline
                          (Identity Resolution → Graph Write
                           → Commitment Extraction → Embedding)
```

| Endpoint | Method | Description |
|---|---|---|
| `/api/events` | POST | Ingest a single structured event → Kafka |
| `/api/events/batch` | POST | Bulk ingest up to 1000 events → Kafka |
| `/api/events/transcript` | POST | Accept STT transcript → LLM extraction → Kafka |
| `/api/search` | POST | Universal smart search |
| `/api/search/similar` | POST | Vector similarity search |
| `/api/graph/explore` | POST | Node re-center (click exploration) |
| `/api/insights` | POST | LLM analysis with reasoning chain |
| `/api/patterns/discover` | POST | Graph algorithm pattern detection |
| `/api/profiles/[id]` | GET | Full profile + identities + events + commitments |
| `/api/alerts` | GET | Active proactive alerts |
| `/api/stats` | GET | Value dashboard metrics |
| `/api/schema` | POST | Initialize graph schema |

All endpoints scoped to tenant via auth token.

**Note on structured vs. unstructured ingestion:** Structured events (web SDK, CRM, webhooks) do not go through LLM extraction — they write directly to the graph via deterministic mapping rules. Only unstructured content (transcripts, free-text notes, doctor dictation) goes through LLM extraction. This means ~90% of production event volume is processed at near-zero cost.

**Production roadmap:** At scale, this becomes a tiered extraction pipeline — rules engine handles structured events (90% volume, zero LLM cost), a lightweight classifier filters non-decision-bearing unstructured content (cuts LLM costs by ~80%), and only decision-bearing content reaches the full extraction model. Orchestrated by Temporal for durable workflows with retry, compensation, and human-in-the-loop support.

### Transcript Ingestion (F7a)

**The most powerful ingestion path.** Raw conversation goes in, structured context graph comes out.

**Accepts any STT output format:**
```json
{
  "source": "voice_stt",
  "call_id": "call_abc123",
  "timestamp": "2026-04-09T14:30:00Z",
  "duration_seconds": 240,
  "participants": [
    { "role": "customer", "phone": "9876543210" },
    { "role": "agent", "name": "Ravi K.", "agent_id": "agent_ravi_001" }
  ],
  "transcript": [
    { "speaker": "agent", "text": "Hi, how can I help?", "start": 0.0 },
    { "speaker": "customer", "text": "I ordered Nike Air Max last month, size is too small, I want to return.", "start": 3.2 },
    { "speaker": "agent", "text": "I see it's 35 days. Policy is 30, but you're Gold, I'll approve the return.", "start": 12.5 },
    { "speaker": "agent", "text": "I'll process your refund within 48 hours.", "start": 25.3 }
  ]
}
```

**LLM extracts from the conversation (with confidence scoring):**
- **Identifiers** — phone, email, name, order ID (for identity resolution)
- **Events** — support_call, return_initiated (with product, payment, policy, agent)
- **Decisions** — policy exception granted (Day 35 > 30-day window, reason: Gold tier)
- **Commitments** — "Refund within 48 hours" (tracked with deadline)
- **Sentiment** — frustrated → resolved
- **Confidence score** — 0.0 to 1.0 per extracted event, indicating how clearly the transcript supports the extraction

**Works for both verticals:**
- Retail: support calls, complaint calls, sales conversations
- Healthcare: doctor dictation notes, patient intake calls, discharge summaries

**Extracted events flow into the same Kafka pipeline as structured events — identity resolution, graph write, commitment tracking all happen identically.**

**Confidence scoring:** Every LLM extraction returns a confidence score (0.0 – 1.0) stored as a property on the Event/Visit node. In the hackathon, all extracted events are written to the graph regardless of confidence. The score is displayed in the UI (graph node badge, timeline badge) so evaluators can see extraction quality at a glance.

**Production roadmap:** In production, confidence gates the write path — high-confidence (>0.85) auto-commits, medium-confidence (0.6–0.85) routes to a human review queue (HITL), low-confidence (<0.6) is rejected. Validated human reviews become training data for fine-tuning smaller, cheaper extraction models (the HITL → SLM flywheel).

**Acceptance criteria:**
- Accepts transcript JSON from any STT provider
- LLM extracts structured events in < 5 seconds
- Each extracted event includes a confidence score (0.0–1.0)
- Extracted events produce to Kafka (same pipeline as structured events)
- Multiple events extracted from a single conversation (support call + return + commitment)
- Sentiment tracked as a property on the call event
- Works for both retail and healthcare transcripts

### F7b: Connector Integration Layer (HubSpot · Zendesk · Nurix)
**Three pre-built adapters that pull external data into the context graph. Each connector maps source-native payloads into the standard ContextMesh event schema — everything downstream (identity resolution, graph write, commitment extraction) is unchanged.**

```
HubSpot (CRM)   ──────┐
                       │   ┌─────────────────┐   ┌──────────────────┐
Zendesk (Support) ─────┼──▶│  Adapter Layer  │──▶│  /api/events     │──▶ Existing Pipeline
                       │   │  (per-source    │   │  (Zod → Kafka →  │
Nurix (Voice)    ──────┘   │   transform)    │   │   Graph Write)   │
                           └─────────────────┘   └──────────────────┘

Webhook receivers:
  POST /api/ingest/hubspot
  POST /api/ingest/zendesk
  POST /api/ingest/nurix

Pull sync:
  POST /api/connectors/sync
```

#### HubSpot CRM
Maps contacts, deals, and tickets into the event pipeline. Lifecycle stage maps to customer tier (lead → Bronze, customer → Gold, evangelist → Platinum). Contact email + phone become strong identity anchors for cross-source resolution.

| HubSpot Object | ContextMesh Event | Key Data |
|---|---|---|
| Contact (modified) | `contact_updated` | email, phone, name, city, tier (from lifecycle) |
| Deal (stage change) | `deal_stage_changed` / `deal_won` | deal value, stage, associated contact |
| Ticket (created/updated) | `support_ticket` / `ticket_closed` | subject, priority, associated contact |

#### Zendesk Support
Maps tickets, comments, audits, and CSAT ratings into decision traces. Agent assignments map to `Agent` nodes. Priority escalations emit dedicated `ticket_escalated` events for the alert engine to detect.

| Zendesk Object | ContextMesh Event | Key Data |
|---|---|---|
| Ticket (new/solved) | `ticket_created` / `ticket_resolved` | subject, priority, channel, satisfaction |
| Comment (agent/customer) | `agent_reply` / `customer_reply` | content, author, public/private |
| Audit (escalation) | `ticket_escalated` | from/to priority, changed by |
| Satisfaction rating | `satisfaction_rated` | score, comment |

#### Nurix Voice (Hackathon: Sample Data)
Maps AI call center logs into support events. The full transcript is stored on the Event node; optionally piped through the LLM extraction pipeline (Section F7a) for deeper entity/commitment extraction.

**Hackathon approach:** Live Nurix API integration is deferred (call logs require internal decryption access). Instead, 8 realistic sample call transcripts are pre-loaded as fixtures and triggered during seed loading or via a "Load Sample Calls" button in the dashboard.

| Sample Call | Caller | Pattern Created |
|---|---|---|
| Call 1 | Priya M. | Return escalation → links to HubSpot + Zendesk profile via phone |
| Call 2 | Priya M. | Commitment "refund within 48h" — will breach |
| Call 3 | Amit K. | AI-resolved, positive sentiment |
| Call 4-8 | Various | COD wrong item, loyalty complaint, dropped call (churn risk), repeat escalation |

Phone numbers match HubSpot and Zendesk test data — identity resolution merges all three sources into unified profiles automatically.

**Cross-source identity resolution:** When HubSpot (email), Zendesk (email), and Nurix (phone) all reference the same person, the identity resolver merges them into a single Profile with 3+ Identity nodes and a unified event timeline spanning all three sources.

**Acceptance criteria:**
- HubSpot webhook receiver accepts subscription events and maps to ContextMesh events
- Zendesk webhook receiver accepts trigger payloads and maps to ContextMesh events
- Nurix adapter loads 8 sample calls and POSTs them through the ingestion pipeline
- Cross-source identity resolution links records from all three sources into unified profiles
- Connector sync API (`POST /api/connectors/sync`) triggers pull from any configured source
- All connector events appear on the same timeline as structured and transcript events

---

### F8: Agent Integration Layer (Side A)
**Any external AI agent or application connects to ContextMesh through three interfaces — same data, same auth, pick your protocol.**

```
┌─────────────────────────────────────────────────────────┐
│               EXTERNAL AI AGENTS / APPS                  │
│                                                          │
│  Claude, LangChain ──┐                                   │
│  CrewAI, AutoGPT ────┤──▶ MCP Protocol (auto-discover)  │
│  Any MCP agent ──────┘                                   │
│                                                          │
│  Custom bots ────────┐                                   │
│  Backend services ───┤──▶ REST API (direct HTTP)         │
│  Webhooks ───────────┘                                   │
│                                                          │
│  Python apps ────────┐                                   │
│  Node.js apps ───────┤──▶ SDK (1-line setup)             │
│  Any language ───────┘                                   │
│                                                          │
│  All three → same graph, same data, same auth            │
└─────────────────────────────────────────────────────────┘
```

#### Interface 1: MCP Server (Primary)
**The main integration path.** AI agent frameworks connect, auto-discover available tools, and call them natively. Zero custom integration code.

```
MCP Endpoint: /api/mcp

Available tools (auto-discovered by agent):
┌────────────────┬──────────────────────────────────────────┐
│ get_context    │ Full pre-conversation brief for a person │
│ search         │ Natural language search across the graph │
│ analyze        │ LLM insight with reasoning chain         │
│ find_similar   │ Vector similarity search                 │
│ track_event    │ Ingest a new event into the graph        │
│ get_alerts     │ Active proactive alerts                  │
│ get_commitments│ Open/breached commitments for a person   │
└────────────────┴──────────────────────────────────────────┘
```

Any MCP-compatible agent connects in one config:
```json
{
  "mcpServers": {
    "contextmesh": {
      "url": "https://contextmesh.app/api/mcp",
      "apiKey": "sk_tenant_xxx"
    }
  }
}
```

Agent auto-discovers tools → calls `get_context` before a conversation → calls `track_event` after → calls `analyze` when user asks "why?"

#### Interface 2: REST API
**Direct HTTP calls for bots, backend services, and custom integrations.**

```
GET  /api/agent/context?phone=9876543210   → pre-conversation brief
POST /api/search          { query: "..." } → graph search
POST /api/insights        { context: ... } → reasoning chain
POST /api/search/similar  { node_id: ... } → vector similarity
POST /api/events          { event: ... }   → ingest event
POST /api/events/transcript { transcript } → STT ingestion
GET  /api/alerts                           → active alerts
GET  /api/profiles/[id]                    → full profile
```

#### Interface 3: SDK (Python + JavaScript)
**Thin wrappers over REST API for the simplest possible integration.**

```python
# Python — 3 lines to full context
from contextmesh import ContextMesh

cm = ContextMesh(api_key="sk_xxx", tenant="city_hospital")
context = cm.get_context(phone="9876543210")
# → profile, events, commitments, risk signals, suggested actions

# Search the graph
results = cm.search("readmissions within 30 days")

# Ingest an event
cm.track("visit", patient_id="amit_001", diagnosis="STEMI", severity="Critical")

# Get AI analysis
insight = cm.analyze(results)  # → context, reasoning chain, result
```

```javascript
// JavaScript — same API
import { ContextMesh } from '@contextmesh/sdk';

const cm = new ContextMesh({ apiKey: 'sk_xxx', tenant: 'myntra_demo' });
const context = await cm.getContext({ phone: '9876543210' });
const results = await cm.search('Gold tier returns in Bangalore');
await cm.track('return_initiated', { product: 'Nike Air Max', reason: 'size' });
```

#### Pre-Conversation Brief (all interfaces return this)
```json
{
  "profile": { "name": "Priya M.", "tier": "Gold", "city": "Bangalore", "ltv": 120000, "risk_score": 0.72 },
  "recent_events": [
    { "type": "return_initiated", "product": "Nike Air Max", "days_ago": 3, "relevance": 0.94, "confidence": 0.87 },
    { "type": "purchase", "product": "Levis Jacket", "days_ago": 15, "relevance": 0.71, "confidence": 0.95 }
  ],
  "open_commitments": [
    { "promise": "Refund within 48h", "deadline": "2026-04-11", "status": "breached", "assignee": "Ravi K." }
  ],
  "active_exceptions": [
    { "policy": "Return Policy v3.2", "exception": "Day 35 return approved", "reason": "Gold + first late return" }
  ],
  "similar_cases": [
    { "profile": "Rahul S.", "similarity": 0.89, "outcome": "Retained after expedited refund" },
    { "profile": "Meera P.", "similarity": 0.82, "outcome": "Churned after 2nd breach" }
  ],
  "risk_signals": [ "2 returns in 30 days", "1 breached commitment", "declining sentiment" ],
  "suggested_actions": [ "Apologize for delayed refund", "Offer express processing", "Do NOT promise further deadlines until refund is confirmed" ]
}
```

**How suggested_actions works:** Claude Sonnet receives the assembled context and generates 2-3 specific, actionable suggestions. Not generic — tailored to THIS customer's history.

**Post-Conversation Trace Commit:**
Already handled by `/api/events/transcript` — after a call ends, STT output hits any of the 3 interfaces, Kafka pipeline processes it into the graph.

**Acceptance criteria:**
- MCP server exposes 7 tools, auto-discoverable by any MCP-compatible agent
- REST API returns full agent brief in <100ms (cache hit) / <300ms (cache miss)
- Python SDK and JS SDK published as packages (~50 lines each, wrapping REST)
- Suggested actions are specific to the customer, not generic
- All three interfaces return identical data
- Auth: API key scoped to tenant (same key works across all 3 interfaces)
- Works for both retail (customer context) and healthcare (patient context)

### F9a: Client Intelligence Dashboard (Side B)
**Pre-built analytics views for operations managers, compliance officers, and analysts.**

Side B is the "decision intelligence" product — consumed by business users via the dashboard.

The current dashboard (`/dashboard`) has search + graph + timeline + insights. Side B adds dedicated analytics pages:

**Analytics Overview (`/dashboard/analytics`):**
- Decision volume by type, channel, time period (line chart)
- Exception rate trend — overall and by policy (area chart)
- Event source breakdown — web vs app vs voice vs CRM (pie chart)
- Top products/diagnoses by event volume (bar chart)

**Policy Drift (`/dashboard/policies`):**
- Table: every policy with written rule vs actual override rate
- Highlight policies > 30% override rate in red
- **Policy version tracking:** Show active vs superseded policies side by side. Traces linked to superseded policies are visually dimmed and scored lower by the relevance engine.
- Click any policy → graph shows all related exceptions
- Trend line: override rate over time (is it getting worse?)
- LLM recommendation per drifted policy

**Agent/Provider Performance (`/dashboard/agents`):**
- Comparison table: exception rate, resolution time, retention/outcome rate per agent/provider
- Consistency score: how similarly do agents handle the same case type?
- Highlight outliers — both good (Ravi: high exceptions but best retention) and bad
- Click any agent → graph shows their decision patterns

**Commitment Tracking (`/dashboard/commitments`):**
- Active commitments list with countdown timers
- Breached commitments with linked profiles
- Fulfillment rate by agent/provider (bar chart)
- Trend: are we getting better or worse at keeping promises?

**All pages share:**
- Same filter bar (vertical-aware)
- Date range selector
- Export to CSV
- Each metric links back to the graph view for drill-down

**Acceptance criteria:**
- 4 analytics pages with live data from Neo4j
- Charts render correctly with seeded demo data
- Every metric is clickable → navigates to graph view with relevant context
- Works for both retail and healthcare (labels adapt per vertical)

### F10: Seed Demo Datasets

#### Retail (Myntra-style)
- 50 user journeys with full lifecycle
- 20 products across Footwear, Apparel, Accessories
- Mix of tiers, cities, payment methods
- Embedded patterns: Nike sizing issues, EORS spike, Gold tier exceptions, COD-return correlation, agent Ravi's approval pattern
- **Policy versions seeded:** Return Policy v3.1 (superseded, effective Jan 2025) and v3.2 (active, effective Oct 2025). Traces linked to v3.1 have relevance decay applied.

#### Healthcare (Hospital)
- 50 patient journeys across departments
- 15 providers across Cardiology, Orthopedics, General Medicine, Emergency, Neurology
- Mix of conditions: cardiac events, fractures, diabetes management, respiratory infections, neurological events
- **Protocol versions seeded:** Acute MI Protocol v1.0 (superseded) and v2.1 (active). Old cases under v1.0 score lower in relevance.
- Embedded patterns:
  1. **Readmission cluster:** 4 cardiac patients readmitted within 30 days — linked to missed follow-up protocol
  2. **Insurance denial pattern:** Knee replacement claims denied 60% when pre-auth missing
  3. **Provider deviation:** Dr. Sharma deviates from STEMI protocol 30% of time — but has 15% better outcomes
  4. **Medication switch pattern:** Diabetic patients switching from metformin to insulin after ER visit — protocol says try dose increase first
  5. **ER bottleneck:** Neurology consult wait > 4 hours causing 3x longer ER stays
  6. **Department load imbalance:** Cardiology 40% over capacity, Orthopedics 20% under

**Data sensitivity note:** All demo data is fully synthetic. No real patient, customer, or business data is used. Production roadmap includes Presidio (open-source, container-based PII detection/redaction) running in-cluster before graph write — no data leaves the compute boundary. For healthcare production deployments, HIPAA BAA and PHI access controls are on the compliance roadmap.

### F11: Vector Similarity Search — "Find Similar"
**"Find similar" button on any Profile, Event, or Visit node.** Uses Neo4j's built-in vector index to find semantically similar journeys, not just keyword matches.

**How it works:**
1. Every Profile's journey is embedded as a vector (via @xenova/transformers — runs locally, no API cost)
2. Vectors stored in Neo4j's native vector index (since v5.11)
3. User clicks "Find Similar" on a node → vector similarity search returns top matches
4. Results rendered as a comparison graph — original node + similar nodes + what they have in common

**Retail example:**
```
Click "Find Similar" on Priya's return event
→ Returns 3 other users with similar return patterns:
  - Rahul: same product, same sizing issue, Day 33 return
  - Meera: different product, same COD + return + Gold tier pattern
  - Arjun: same brand, same city, similar LTV range
→ Graph shows shared connections (same product, same policy, same agent)
```

**Healthcare example:**
```
Click "Find Similar" on Amit's readmission
→ Returns 3 patients with similar readmission patterns:
  - Suresh: same diagnosis, same stent type, 22-day readmission
  - Kavita: different diagnosis but same missed follow-up protocol
  - Rajan: same provider, same department, similar timeline
→ Graph highlights the shared risk factors
```

**Why this matters:**
- Keyword search finds exact matches. Vector search finds **pattern matches** — cases that are similar in meaning even if the words are different
- Enables precedent discovery: "show me how similar cases were handled"
- One query, one database — no separate vector store to sync

**Acceptance criteria:**
- Works on any Profile, Event/Visit node
- Returns top 3-5 similar results with similarity score
- Results rendered as a comparison graph with shared connections highlighted
- Response time < 3 seconds

### F12: Pattern Discovery — Graph Algorithms
**"Discover Patterns" button on the dashboard.** Runs Neo4j graph algorithms to automatically find clusters of related decisions, influential nodes, and hidden connections.

**Algorithms used:**
1. **Community Detection (Louvain)** — finds clusters of closely-related traces
2. **PageRank** — identifies the most influential nodes (which policies, products, or providers appear in the most decision chains)
3. **Shortest Path** — finds how two seemingly unrelated events are connected

**Retail example:**
```
Click "Discover Patterns"
→ Found 3 clusters:
  Cluster 1: "Nike Sizing Returns" (8 traces)
    - 8 users returned Nike products citing size issues
    - All Gold/Platinum tier, all got exceptions
    - Agent Ravi handled 6 of 8
  
  Cluster 2: "EORS Impulse Buyers" (12 traces)
    - 12 users purchased during EORS sale
    - 9 used COD, 7 returned within 14 days
    - Pattern: COD + sale purchase = high return risk
  
  Cluster 3: "Loyal Cart Abandoners" (5 traces)
    - 5 Gold users who abandon cart 2-3 times before buying
    - All eventually purchase when price drops
    - Pattern: price sensitivity despite high tier
```

**Healthcare example:**
```
Click "Discover Patterns"
→ Found 3 clusters:
  Cluster 1: "Post-PCI Readmission Risk" (4 patients)
    - All cardiac, all same stent type, all readmitted 18-28 days
    - All had missed follow-up angiogram
    - Provider: Dr. Sharma (3 of 4)
  
  Cluster 2: "Insurance Denial Loop" (6 cases)
    - Knee replacements denied → resubmitted → 4 approved on appeal
    - Common factor: Dr. Mehta skips pre-auth filing
  
  Cluster 3: "Medication Escalation" (5 patients)
    - Diabetic patients: metformin → ER visit → insulin switch
    - Protocol says try dose increase first — skipped in all 5
```

**This is the "Tribal Knowledge Extractor" from the blueprint — automatically surfacing undocumented patterns that no human asked about.**

**Acceptance criteria:**
- Runs community detection on the current tenant's graph
- Returns 3-5 clusters with human-readable summaries
- Each cluster shows: member count, common factors, pattern description
- LLM generates the cluster summary from raw graph data
- Response time < 5 seconds

### F13: Relevance Scoring
**Every node in search results gets a relevance score (0-1).** Recent, high-confidence, active-policy results rank higher than old, low-confidence, superseded-policy results.

**Formula:**
```
relevance = base_confidence
           × recency_weight    (exponential decay: EXP(-0.01 × age_days))
           × policy_currency   (1.0 if active, 0.1 if superseded, 0.0 if revoked)
           × outcome_success   (1.0 if positive outcome, 0.5 if mixed, 0.2 if negative)
```

**Policy currency is the key differentiator.** When a Policy or Protocol node has `status: superseded`, all traces linked to it via `GOVERNED_BY` or `OVERRODE` relationships automatically score lower. This prevents stale precedents from poisoning recommendations. The `SUPERSEDED_BY` edge connects old and new policy versions, so the graph explicitly tracks the version chain.

**How it appears in the UI:**
- Each node shows a relevance badge: `0.92`, `0.78`, `0.45`
- Nodes are sized proportionally — higher relevance = larger node
- Low-relevance nodes are visually dimmed
- Sort toggle: "Sort by time" vs "Sort by relevance"
- Timeline view can filter: "Show only high-relevance events (>0.7)"

**Retail example:**
```
Search: "return exceptions for Gold tier"
→ Return from 2 days ago: relevance 0.94 (recent, active policy, customer retained)
→ Return from 30 days ago: relevance 0.72 (older, active policy, outcome pending)
→ Return from 90 days ago: relevance 0.31 (old, policy v3.1 superseded by v3.2)
```

**Healthcare example:**
```
Search: "STEMI treatment protocols"
→ Dr. Sharma's PCI case (5 days ago): relevance 0.91 (recent, protocol v2.1 active, good outcome)
→ Dr. Patel's case (45 days ago): relevance 0.68 (older, same protocol, readmission)
→ Old case under Protocol v1.0: relevance 0.15 (protocol superseded, outdated approach)
```

**Acceptance criteria:**
- Every event/visit node has a computed relevance score
- Score is visible on the graph and timeline
- High-relevance nodes are visually prominent
- Filter available to hide low-relevance results

**Production roadmap:** At scale, relevance scoring also incorporates approver authority (seniority-weighted) and precedent conflict resolution — when two precedents conflict, both are surfaced with an explanation of why each scored differently, and the agent's final decision becomes a new trace that adds signal to future rankings.

### F14: Commitment Tracker
**Automatically extract promises and commitments as first-class graph nodes.**

Events and visits often contain promises: "refund within 24 hours", "follow-up appointment in 2 weeks", "we'll escalate to the brand team." These commitments currently disappear. ContextMesh tracks them.

**How it works:**
1. During event ingestion, LLM scans event properties/notes for commitment language
2. Each commitment becomes a `Commitment` node in the graph
3. Linked to: Profile (who was promised), Agent/Provider (who promised), Event/Visit (when)
4. Tracked through lifecycle: `open` → `fulfilled` / `breached` / `cancelled`

**Commitment node:**
```
(:Commitment {
  commitment_id, promise_text, deadline, status,
  assignee, created_at, fulfilled_at, breached_at
})
```

**Retail example:**
```
Priya's return → Agent Ravi promised: "Refund processed within 48 hours"
→ Commitment node: { promise: "Refund within 48h", deadline: Apr 7, status: "open" }
→ Apr 8: deadline passed, status → "breached"
→ Shows on Priya's profile: "⚠ 1 breached commitment"
```

**Healthcare example:**
```
Amit's discharge → Dr. Sharma: "Follow-up angiogram in 2 weeks"
→ Commitment node: { promise: "Follow-up angiogram", deadline: Mar 29, status: "open" }
→ Mar 29: no follow-up visit recorded, status → "breached"
→ Shows on Amit's profile: "⚠ Missed follow-up — linked to readmission"
```

**Dashboard visibility:**
- Profile detail panel shows open/breached/fulfilled commitments
- Search: "breached commitments last 30 days" → graph of all broken promises
- Agent view: fulfillment rate per agent (Ravi: 78%, Anita: 95%)

**Acceptance criteria:**
- Commitments extracted from events and stored as graph nodes
- Lifecycle tracking: open → fulfilled/breached/cancelled
- Breach detection: auto-flag when deadline passes without fulfillment
- Visible on Profile detail panel and searchable via universal search

### F15: Proactive Alerts
**System automatically detects anomalies and surfaces them without being asked.**

Three types of proactive alerts:

**1. Policy Drift Detection**
```
⚠ Return Policy v3.2 has been overridden 72% of the time for Gold tier
  customers in the last 90 days. Consider formalizing the exception.
```
Triggers when override rate exceeds 30% (configurable threshold).

**2. Churn/Readmission Risk**
```
⚠ Patient Amit Kumar: high readmission risk (score: 0.84)
  Factors: missed follow-up, post-PCI complication, same stent batch
```
Computed from: sentiment trajectory, escalation frequency, commitment breach rate, clinical risk factors.

**3. Anomaly Spikes**
```
⚠ Return rate for Nike Footwear spiked 3x this week (34% vs 11% avg)
  Top reason: "size runs small" (67% of returns)
```
Triggers on statistical deviation from 30-day moving average.

**How they appear:**
- Alert bell icon in dashboard header with count badge
- Alert panel slides out showing all active alerts
- Each alert links to the relevant graph view (click → see the full context)
- Alerts are generated by a background job that runs daily (or on-demand)

**Acceptance criteria:**
- Policy drift detected when override rate > 30%
- Risk scoring computed from graph patterns
- Anomaly spikes detected on statistical deviation
- Alerts visible in dashboard with direct links to graph context

### F16: Value Dashboard
**A stats panel showing quantified impact of the platform.**

Displayed as a summary bar at the top of the dashboard or as a dedicated `/analytics` page.

**Metrics shown:**

| Metric | Retail Example | Healthcare Example |
|---|---|---|
| **Events Tracked** | 2,847 events across 50 users | 1,523 visits across 50 patients |
| **Patterns Discovered** | 3 clusters (Nike sizing, EORS impulse, cart abandonment) | 3 clusters (readmission risk, insurance denials, medication switches) |
| **Insights Generated** | 12 reasoning chains produced | 8 reasoning chains produced |
| **Commitments Tracked** | 34 open, 28 fulfilled, 6 breached | 22 open, 15 fulfilled, 7 breached |
| **Policy Drift Detected** | Return Policy v3.2: 72% override rate | Protocol v2.1: 30% follow-up missed |
| **Alerts Raised** | 4 active alerts | 3 active alerts |
| **Profiles Resolved** | 50 profiles from 127 identity fragments | 50 profiles from 89 identity fragments |
| **Avg Extraction Confidence** | 0.86 | 0.88 |

**Acceptance criteria:**
- Stats computed from actual graph data (not hardcoded)
- Updates on each dashboard load
- Shows both aggregate and per-vertical metrics
- Clean, scannable layout (judges see business value at a glance)

---

### F17: Pipeline Trace Panel (Debug / Demo Mode)
**A toggleable panel that exposes every backend step in real time — for demos, debugging, and showing judges the engine behind the output.**

Click the **[🔬 Debug]** toggle in the dashboard header. A panel slides in from the right and auto-updates on every action (search, event ingestion, insight, connector sync). When the toggle is off, overhead is zero — the tracer is not instantiated.

**What it shows for a search query:**
```
🔍 Search: "Gold tier returns in Bangalore"  •  997ms  •  ✅
│
├─ 1. Auth & Tenant Resolution     2ms   ✅  auth
│     fn: requireTenant()
│     → tenant_abc, vertical: retail, plan: enterprise
│
├─ 2. Vertical Schema Load         1ms   ✅  validation
│     fn: getVertical("retail")
│     → 8 node types, 12 relationships
│
├─ 3. LLM Cypher Generation      847ms  ✅  llm
│     fn: generateCypher()  •  llama-3.3-70b  •  1,240 tokens
│     → MATCH (p:Profile {tier:"Gold"...  confidence: 0.91
│     ▶ Expand to see full Cypher + prompt
│
├─ 4. Cypher Validation            3ms   ✅  validation
│     → read_only: true, tenant_filter: true
│
├─ 5. Neo4j Execution            124ms  ✅  neo4j
│     → 23 rows, 18 nodes, 31 relationships
│
├─ 6. Graph Mapping                8ms   ✅  mapping
│     → 18 nodes, 31 edges
│
└─ 7. Relevance Scoring           12ms  ✅  scoring
      → avg: 0.78, max: 0.94, min: 0.23
```

**Also traces:** event ingestion (adapter → Zod → identity resolution → graph write → commitment extraction → embedding), connector sync (test → pull → pipeline → identity summary), and LLM insight (context → reasoning → result).

**Layer color coding:**
| Layer | Color | What It Covers |
|---|---|---|
| `auth` | Gray | Session, tenant resolution, API key |
| `validation` | Blue | Zod, Cypher validation, schema load |
| `llm` | Purple | Claude — Haiku (extraction), Sonnet (reasoning) |
| `neo4j` | Green | Graph reads, writes, identity resolution |
| `mapping` | Orange | Adapter transforms, Neo4j→ReactFlow |
| `scoring` | Teal | Relevance, risk, confidence |

**Duration bar** at the bottom of the panel shows proportional time per step, color-coded by layer — makes the LLM bottleneck instantly visible vs Neo4j.

Each step is collapsible — click to expand full input/output JSON.

**Acceptance criteria:**
- Toggle button in dashboard header
- Panel slides in from right, auto-updates per action
- Each step shows: name, function name, layer, duration, status, input/output summary
- Steps are collapsible — expand shows full JSON
- Duration bar visualization, color-coded by layer
- Toggle off = zero overhead on all API routes

---

## 6. Tech Stack

### Hackathon Stack (Current)

| Layer | Technology | Why This (Hackathon) | Production Upgrade Path |
|---|---|---|---|
| **Framework** | Next.js 14 (App Router) | Full-stack in one deploy — API routes + dashboard + auth in a single project. Zero config deployment. | Same — Next.js scales to production. Add dedicated API service if needed. |
| **Auth** | NextAuth.js (Google + credentials) | Multi-tenant auth in 1 hour setup. Google OAuth is free, no approval needed. | Add SAML/SSO for enterprise clients (Auth0 or Clerk) |
| **UI** | React 18 + Tailwind CSS | Fast iteration, consistent dark theme, responsive out of the box. | Same — production-ready as-is |
| **Graph Visualization** | React Flow | Best open-source graph UI. Interactive, draggable, zoomable. No license cost. | Same — or upgrade to Cytoscape.js for 10K+ node graphs |
| **Graph Database** | Neo4j (Aura free tier) | Only graph DB with native vector search + graph algorithms (GDS) + full-text search in one database. Free tier: 200K nodes. Neptune can't do vector + algorithms. | Neo4j AuraDB Pro ($65/mo) or self-hosted on K8s |
| **Event Streaming** | Upstash Kafka (serverless) | Real Kafka with REST API — no brokers to manage, no Docker needed. Free tier: 10K msgs/day. | Confluent Cloud or Strimzi on Kubernetes |
| **LLM** | Anthropic API — `claude-haiku-4-5` (extraction) + `claude-sonnet-4-6` (reasoning/synthesis) | Haiku: fast structured extraction from transcripts. Sonnet: complex reasoning, agent context, pattern summaries. Company API key — no cost. | Add self-hosted SLM for >100K events/day volume. |
| **App Database** | SQLite (via Prisma) | Zero setup — just a file. Handles users, orgs, plans. Perfect for hackathon. | PostgreSQL (AWS RDS or K8s operator) |
| **Validation** | Zod | Runtime schema validation at API boundary. TypeScript-native. | Same — production-ready |
| **Language** | TypeScript | End-to-end type safety. Same language frontend + backend. | Same |
| **Deployment** | Vercel (or AWS Amplify) | One-click deploy from git. Free tier. Zero DevOps. | AWS EKS (Kubernetes) for multi-cloud + on-prem option |

### Why These Specific Choices

**Neo4j over Postgres/MongoDB:** A return exception connects to a customer, product, policy, agent, and outcome. In Postgres, that's 6 tables + 5 JOINs. In Neo4j, it's one traversal query. Graph databases are purpose-built for connected data — which is exactly what a context graph is.

**Neo4j over AWS Neptune:** Neptune can't do vector search (needs separate OpenSearch), can't do graph algorithms (no GDS), can't deploy on-prem, and uses a limited subset of Cypher. Neo4j does all of these natively in one database.

**Claude (Haiku + Sonnet) via company API:** Two-tier model strategy — Haiku handles high-volume structured extraction (fast, cost-efficient), Sonnet handles complex reasoning and synthesis (higher quality). Both available via company Anthropic API key at no personal cost. Haiku extraction latency is sub-500ms; Sonnet reasoning under 2s.

**Upstash Kafka over direct API → DB:** Even for a hackathon, Kafka gives us: decoupled ingestion (API responds instantly), durability (events survive crashes), replay (reprocess if schema changes). Upstash makes this free and simple — REST API, no Kafka client library needed.

**SQLite over Postgres (for hackathon):** Users, orgs, and plans are simple relational data. SQLite is a file — zero setup, works with Prisma identically to Postgres. One config line change to upgrade later.

### Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                     CONTEXTMESH PLATFORM                       │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    AUTH LAYER                             │  │
│  │    NextAuth.js · Google · Email/Password · Org Scope     │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               PLAN GATING MIDDLEWARE                      │  │
│  │        Starter / Pro / Enterprise feature flags           │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              VERTICAL-AWARE DASHBOARD                     │  │
│  │    Search Bar · Graph · Timeline · Insights · Filters     │  │
│  │    Schema + colors + filters adapt to org's vertical      │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         ▼                                       │
│  ┌─────────────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  Cypher Generator│  │  Claude  │  │  Neo4j (Aura)        │  │
│  │  (LLM → query)  │──│  LLM API │  │  Graph DB + Vector   │  │
│  └─────────────────┘  └──────────┘  │  Tenant-scoped       │  │
│                                      └───────────┬──────────┘  │
│                                                   ▲             │
│                                                   │             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              EVENT STREAMING PIPELINE                     │  │
│  │                                                           │  │
│  │  Producer          Upstash Kafka          Consumer        │  │
│  │  (API route)  ──▶  [Topic per tenant] ──▶ (processor)    │  │
│  │                                            │              │  │
│  │                                   Identity Resolution     │  │
│  │                                   + Graph Write           │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### Why Kafka (Even for a Hackathon)?

1. **Decouples ingestion from processing** — API responds instantly, graph write happens async
2. **Durability** — events survive if Neo4j is temporarily down
3. **Replay** — can reprocess events if schema changes or bugs are found
4. **Scale story** — judges see a production-grade pipeline, not a toy REST-to-DB setup
5. **Upstash Kafka** — serverless, free tier (10K messages/day), REST API (no Kafka client library needed), zero ops

---

## 7. Data Flow

### Onboarding Flow
```
Sign Up → Create Org (name + vertical) → Provision tenant_id
→ Create Kafka topic (tenant-scoped) → Init graph schema
→ Seed demo data (via Kafka) → Land in dashboard
```

### Ingestion Flow (Event Streaming Pipeline)
```
External App / SDK
    │
    ▼
POST /api/events (with auth token)
    │
    ├─ Zod Validation
    │
    ├─ Produce to Kafka topic: "events-{tenantId}"
    │  (API responds 202 Accepted immediately)
    │
    ▼
Kafka Consumer (background processor)
    │
    ├─ Deserialize event
    ├─ Identity Resolution (resolve/create Profile)
    ├─ Create Event + context nodes in Neo4j
    ├─ Link Profile → Event
    ├─ Update NEXT chain
    ├─ Generate embedding (if Pro/Enterprise plan)
    │
    ▼
Graph updated, searchable immediately
```

**Key difference from direct REST → Neo4j:**
- API returns `202 Accepted` instantly (event is queued)
- Consumer processes async — handles retries, identity resolution, embedding
- If consumer crashes, events stay in Kafka and are reprocessed on restart
- Batch consumers can process historical backfill at lower priority

### Query Flow
```
Search Bar → POST /api/search (tenant-scoped)
→ Load org's vertical schema → Send to Claude Haiku
→ Cypher generated → Validated → Execute against tenant graph
→ Results → Graph + Timeline + Optional Insight
```

### Connector Sync Flow
```
Webhook (HubSpot/Zendesk/Nurix event fires)
    │
    ▼
POST /api/ingest/{source}
    │
    ├─ Adapter.mapWebhook(payload)
    │  → source-native format → ContextMeshEvent
    │
    ├─ POST /api/events (internally)
    │  → Zod validate → Produce to Kafka
    │
    ▼
Same Kafka → Consumer → Identity Resolution → Graph Write
    │
    ▼
Cross-source profile unified (HubSpot + Zendesk + Nurix → 1 Profile)
```

Or pull mode:
```
POST /api/connectors/sync { type: "zendesk", since: "..." }
    │
    ├─ Adapter.sync(config, since) → fetch from source API
    ├─ Map all records → ContextMeshEvents[]
    ├─ POST /api/events/batch
    │
    ▼
Same pipeline as above
```

---

## 8. Demo Scenario (Hackathon)

### Setup
- Two demo orgs pre-created: "Myntra Demo" (retail) and "City Hospital Demo" (healthcare)
- Each pre-loaded with 50 realistic journeys and embedded patterns
- Policy versions seeded (v3.1 superseded, v3.2 active) to demonstrate relevance decay

### Demo Flow (7 minutes)

**1. "One platform, any vertical" (30s)**
- Show login → two orgs available → pick Myntra first

**2. Retail Demo (2.5 min)**
- Search: `"Priya"` → full journey graph (browse → cart → purchase → return → refund)
- Click return node → see Day 37 exception, policy says 30 days
- Point out: confidence badges on extracted events, relevance scores on nodes
- Click policy → see it's overridden 72% of the time for Gold tier
- Note: traces linked to old Policy v3.1 are dimmed (superseded, lower relevance)
- Show breached commitment: "Refund within 48h — deadline passed"
- Search: `"shoes category"` → timeline shows EORS spike + return wave
- Hit "Analyze" → reasoning chain: sizing issue → policy drift → recommendation

**3. Switch to Healthcare (30s)**
- Switch org → "City Hospital Demo" → same UI, different schema, healthcare domain

**4. Healthcare Demo (2.5 min)**
- Search: `"Amit Kumar"` → patient journey graph (ER → Diagnosis → Treatment → Discharge → Readmission)
- Click readmission → see 18 days post-PCI, protocol follow-up was missed
- Show breached commitment: "Follow-up angiogram — deadline passed"
- Search: `"readmissions within 30 days"` → pattern across all patients, 4 linked to stent issue
- Search: `"Dr. Sharma"` → provider view, see protocol deviations but better outcomes
- Hit "Analyze" → reasoning chain: missed follow-up → stent batch issue → 3 at-risk patients identified

**5. "Same engine, any question" (1 min)**
- Search: `"insurance denials cardiology"` → claim denial graph with precedent patterns
- Search: `"metformin to insulin switches"` → medication pattern timeline
- Show API: POST /api/events → any hospital system can push events
- Show MCP config: one JSON block, any AI agent gets full context

**6. Connector + Trace Demo (1 min)**
- Click "Load Sample Calls" → 8 Nurix call transcripts ingested
- Search: `"Priya"` → now shows HubSpot deal + Zendesk ticket + Nurix call on the same timeline
- Toggle [🔬 Debug] → Pipeline Trace Panel slides in
- Search again → panel shows every step live: Auth (2ms) → LLM Cypher (847ms) → Neo4j (124ms) → Relevance scoring (12ms)
- Expand the LLM step → show full Cypher + confidence score
- "Judges can see the engine, not just the output"

### Key Talking Points
- "One platform. Two verticals. Same search bar. Same graph engine."
- "Retail: why did this return happen? Healthcare: why was this patient readmitted?"
- "Every AI insight shows its reasoning — context, logic chain, conclusion. Fully auditable."
- "Every extraction has a confidence score. In production, low-confidence extractions go to human review — building a training flywheel."
- "Stale precedents don't poison the graph — superseded policies are tracked and decayed automatically."
- "HubSpot, Zendesk, and Nurix all feed into the same graph — identity resolution links them into one unified customer profile."
- "Toggle one button and see every backend step — Auth, LLM, Neo4j, scoring — with timing and full I/O. This is what production observability looks like."
- "Not a demo. Production-ready: auth, multi-tenant, plan tiers, API, MCP, connectors."
- "Add any vertical — the graph engine is generic. Schema is the only thing that changes."

---

## 9. Subscription Plans

| | Starter | Pro | Enterprise |
|---|---|---|---|
| **Price** | Free | - | - |
| **Events / month** | 1,000 | 10,000 | Unlimited |
| **Search** | Basic text match | Full LLM → Cypher | Full LLM → Cypher |
| **Graph viz** | 25 nodes | 100 nodes | Unlimited |
| **Timeline** | 7 days | 90 days | Unlimited |
| **LLM insights** | Not available | Summary only | Full reasoning chain |
| **API access** | Not available | Not available | Full REST API |
| **Team members** | 1 | 5 | Unlimited |
| **Seed data** | Included | Included | Custom import |

Plan selector in org settings. No payment — feature gating only for now.

---

## 10. Long-Term Vision

### Two-Sided Business Model

**Side A — Agent Memory:** Give AI agents persistent, structured memory from the context graph.

**Side B — Decision Intelligence Dashboard:** Sellable analytics for enterprises across any vertical.

### Vertical Expansion
| Phase | Vertical | Timeline |
|---|---|---|
| **Now** | Retail + Healthcare | Hackathon |
| **Phase 2** | Insurance / Underwriting | Month 3-6 |
| **Phase 3** | Legal / Compliance, BFSI | Month 6-9 |
| **Phase 4** | Any vertical via custom schema builder | Month 9-12 |

### Revenue Model (Post-Hackathon)
| Plan | Price | Target |
|---|---|---|
| Starter | Free | Individual users, evaluation |
| Pro | $49/mo | Small teams, growing orgs |
| Enterprise | $199/mo | Large orgs, API access, full reasoning chain |
| Custom | Contact sales | On-prem, compliance modules, custom verticals |

---

## 11. Success Metrics

### Hackathon
- [ ] Auth + org creation + vertical selection works
- [ ] Retail vertical: full search, graph, timeline, insights with reasoning
- [ ] Healthcare vertical: full search, graph, timeline, insights with reasoning
- [ ] Both verticals seeded with 50 realistic journeys each (with policy version history)
- [ ] Confidence scores visible on all extracted events/visits
- [ ] Relevance scoring works (superseded policy traces score lower, recent traces score higher)
- [ ] Commitment tracker: open/breached commitments visible on profiles
- [ ] Plan gating works (features restricted by plan)
- [ ] Universal search works with any query combination in both verticals
- [ ] Sub-3-second response time on all queries
- [ ] Clean deploy on AWS/Vercel + Neo4j Aura

### Post-Hackathon
| Metric | Target |
|---|---|
| Traces captured / day / client | 100+ |
| Search query → result time | < 3 seconds |
| Reasoning chain accuracy | 70%+ |
| Extraction confidence (avg) | > 0.80 |
| LLM cost per trace (production) | $0.08-0.12 (Phase 1) → $0.02-0.04 (Phase 4 with SLM) |
| Org sign-ups (first month) | 50+ |
| Vertical expansion | 2 → 5 verticals |

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| LLM generates invalid Cypher | Search fails | Validate before execution; fallback to structured search |
| Neo4j Aura free tier limits | Demo breaks | Keep dataset manageable; pre-cache common queries |
| Graph too dense to visualize | UI confusion | Limit nodes to 50-100; progressive disclosure |
| Claude latency spike | Slow demo | Cache responses for demo queries |
| Healthcare data sensitivity concerns | Judges worried about HIPAA | All demo data is synthetic; production roadmap includes HIPAA compliance |
| LLM extraction quality < 70% | Bad data in graph | Confidence scoring surfaces quality; production adds HITL review queue as quality gate |
| Stale precedents mislead agents | Wrong recommendations | Relevance scoring with policy currency decay; superseded policies auto-deprioritized |
| Two verticals doubles build scope | Won't finish in time | Shared engine handles 90% — only schema + seed data + filters differ per vertical |
| Two verticals doubles build scope | Won't finish in time | Shared engine handles 90% — only schema + seed data + filters differ per vertical |