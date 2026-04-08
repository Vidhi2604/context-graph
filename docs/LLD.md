# ContextMesh — Low-Level Design Document

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                               │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  Dashboard    │  │  JS SDK      │  │  REST API Consumers   │  │
│  │  (Next.js)   │  │  (Browser)   │  │  (Any HTTP Client)    │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘  │
└─────────┼─────────────────┼──────────────────────┼───────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                      API LAYER (Next.js App Router)               │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ /api/events  │  │ /api/search  │  │ /api/users/[id]/events │  │
│  │ /api/events  │  │              │  │ /api/graph/explore     │  │
│  │   /batch     │  │              │  │ /api/insights          │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘  │
└─────────┼─────────────────┼──────────────────────┼───────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                                │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Ingestion    │  │ Query Engine │  │ Insight Engine         │  │
│  │ Service      │  │ (LLM→Cypher)│  │ (LLM Analysis)        │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘  │
└─────────┼─────────────────┼──────────────────────┼───────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                   │
│                                                                   │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐  │
│  │     Neo4j (Aura)         │  │     Groq LLM API            │  │
│  │     Graph Database       │  │     llama-3.3-70b-versatile  │  │
│  └──────────────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
context-graph/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout, fonts, metadata
│   │   ├── page.tsx                    # Landing page
│   │   ├── globals.css                 # Tailwind base styles
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx                # Main dashboard — search, graph, timeline
│   │   │
│   │   └── api/
│   │       ├── events/
│   │       │   ├── route.ts            # POST /api/events — single event ingestion
│   │       │   └── batch/
│   │       │       └── route.ts        # POST /api/events/batch — bulk ingestion
│   │       ├── search/
│   │       │   └── route.ts            # POST /api/search — universal smart search
│   │       ├── graph/
│   │       │   └── explore/
│   │       │       └── route.ts        # POST /api/graph/explore — node re-center
│   │       ├── insights/
│   │       │   └── route.ts            # POST /api/insights — LLM analysis
│   │       ├── users/
│   │       │   └── [id]/
│   │       │       └── events/
│   │       │           └── route.ts    # GET /api/users/[id]/events — user timeline
│   │       └── schema/
│   │           └── route.ts            # POST /api/schema — init graph indexes
│   │
│   ├── lib/
│   │   ├── neo4j.ts                    # Neo4j driver, session helper, runQuery()
│   │   ├── groq.ts                     # Groq client, prompt templates
│   │   ├── cypher-generator.ts         # LLM prompt → Cypher query generation
│   │   └── graph-mapper.ts             # Neo4j result → React Flow nodes/edges
│   │
│   ├── types/
│   │   ├── event.ts                    # Zod schemas + TypeScript types for events
│   │   └── graph.ts                    # Graph node/edge types for frontend
│   │
│   ├── components/
│   │   ├── SearchBar.tsx               # Universal search input + filter chips
│   │   ├── ContextGraph.tsx            # React Flow graph with click-to-recenter
│   │   ├── EventTimeline.tsx           # Chronological timeline view
│   │   ├── NodeDetail.tsx              # Side panel for node properties
│   │   ├── InsightPanel.tsx            # LLM insight display
│   │   └── FilterBar.tsx              # Post-search dimension filters
│   │
│   └── seed/
│       └── retail-data.ts              # Seed script — 50-100 demo journeys
│
├── public/
│   └── contextmesh.js                  # Lightweight JS SDK (future)
│
├── docs/
│   ├── PRD.md
│   └── LLD.md
│
├── .env.local                          # NEO4J_URI, NEO4J_PASSWORD, GROQ_API_KEY
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

---

## 3. Neo4j Graph Schema

### 3.1 Node Labels & Properties

#### User
```
(:User {
  user_id:    String    UNIQUE,     // "user_priya_001"
  name:       String,               // "Priya M."
  phone:      String,               // "9876543210"
  email:      String,               // "priya@example.com"
  tier:       String,               // "Gold" | "Silver" | "Bronze" | "Platinum"
  city:       String,               // "Bangalore"
  ltv:        Float,                // 120000.0 (lifetime value in INR)
  created_at: DateTime
})
```

#### Event
```
(:Event {
  id:             String    UNIQUE, // UUID
  event_type:     String,           // "return_initiated", "purchase", etc.
  timestamp:      DateTime,
  status:         String,           // "completed" | "pending" | "exception" | "denied"
  amount:         Float,            // Transaction amount if applicable
  channel:        String,           // "app" | "web" | "store" | "phone"
  exception:      Boolean,          // Was this a policy exception?
  exception_reason: String,         // Why exception was granted
  properties:     String,           // JSON blob for event-specific data
  created_at:     DateTime
})
```

#### Product
```
(:Product {
  product_id:  String    UNIQUE,    // "nike_air_max_001"
  name:        String,              // "Nike Air Max"
  category:    String,              // "Footwear"
  brand:       String,              // "Nike"
  price:       Float,               // 8499.0
  created_at:  DateTime
})
```

#### Session
```
(:Session {
  session_id:  String    UNIQUE,    // "sess_abc123"
  device:      String,              // "mobile" | "desktop" | "tablet"
  os:          String,              // "iOS" | "Android" | "Windows"
  browser:     String,              // "Chrome" | "Safari" | "App"
  location:    String,              // "Bangalore"
  started_at:  DateTime
})
```

#### Policy
```
(:Policy {
  policy_id:      String    UNIQUE, // "return_policy_v3.2"
  name:           String,           // "Return Policy"
  version:        String,           // "v3.2"
  rule_summary:   String,           // "30-day return window, no exceptions"
  effective_date: DateTime
})
```

#### Agent
```
(:Agent {
  agent_id:   String    UNIQUE,     // "agent_ravi_001"
  name:       String,               // "Ravi K."
  role:       String,               // "L2 Support"
  team:       String,               // "Returns Team"
  created_at: DateTime
})
```

#### Payment
```
(:Payment {
  payment_id: String    UNIQUE,     // "pay_xyz789"
  method:     String,               // "COD" | "UPI" | "Credit Card" | "Debit Card"
  amount:     Float,                // 8499.0
  status:     String,               // "completed" | "refund_pending" | "refunded"
  created_at: DateTime
})
```

#### Outcome
```
(:Outcome {
  outcome_id:  String    UNIQUE,    // "out_abc456"
  type:        String,              // "customer_retained" | "customer_churned" | "product_resold"
  value:       Float,               // Monetary value of outcome
  description: String,              // "Customer retained, product resold at 60%"
  created_at:  DateTime
})
```

### 3.2 Relationships (Edges)

```cypher
// Core journey
(User)-[:PERFORMED {at: DateTime}]->(Event)
(Event)-[:NEXT]->(Event)                        // Sequential event chain

// Context connections
(Event)-[:INVOLVES]->(Product)
(Event)-[:PAID_VIA]->(Payment)
(Event)-[:GOVERNED_BY]->(Policy)
(Event)-[:HANDLED_BY]->(Agent)
(Event)-[:RESULTED_IN]->(Outcome)

// Session grouping
(User)-[:HAS_SESSION]->(Session)
(Session)-[:CONTAINS]->(Event)

// Similarity (for precedent matching)
(Event)-[:SIMILAR_TO {score: Float}]->(Event)
```

### 3.3 Indexes & Constraints

```cypher
// Unique constraints
CREATE CONSTRAINT user_id      IF NOT EXISTS FOR (u:User)    REQUIRE u.user_id IS UNIQUE;
CREATE CONSTRAINT event_id     IF NOT EXISTS FOR (e:Event)   REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT product_id   IF NOT EXISTS FOR (p:Product) REQUIRE p.product_id IS UNIQUE;
CREATE CONSTRAINT session_id   IF NOT EXISTS FOR (s:Session) REQUIRE s.session_id IS UNIQUE;
CREATE CONSTRAINT policy_id    IF NOT EXISTS FOR (p:Policy)  REQUIRE p.policy_id IS UNIQUE;
CREATE CONSTRAINT agent_id     IF NOT EXISTS FOR (a:Agent)   REQUIRE a.agent_id IS UNIQUE;
CREATE CONSTRAINT payment_id   IF NOT EXISTS FOR (p:Payment) REQUIRE p.payment_id IS UNIQUE;
CREATE CONSTRAINT outcome_id   IF NOT EXISTS FOR (o:Outcome) REQUIRE o.outcome_id IS UNIQUE;

// Search indexes
CREATE INDEX user_phone        IF NOT EXISTS FOR (u:User)    ON (u.phone);
CREATE INDEX user_email        IF NOT EXISTS FOR (u:User)    ON (u.email);
CREATE INDEX user_tier         IF NOT EXISTS FOR (u:User)    ON (u.tier);
CREATE INDEX user_city         IF NOT EXISTS FOR (u:User)    ON (u.city);
CREATE INDEX event_type        IF NOT EXISTS FOR (e:Event)   ON (e.event_type);
CREATE INDEX event_timestamp   IF NOT EXISTS FOR (e:Event)   ON (e.timestamp);
CREATE INDEX event_status      IF NOT EXISTS FOR (e:Event)   ON (e.status);
CREATE INDEX product_category  IF NOT EXISTS FOR (p:Product) ON (p.category);
CREATE INDEX product_brand     IF NOT EXISTS FOR (p:Product) ON (p.brand);
CREATE INDEX payment_method    IF NOT EXISTS FOR (p:Payment) ON (p.method);
CREATE INDEX payment_status    IF NOT EXISTS FOR (p:Payment) ON (p.status);

// Full-text search index (for natural language matching)
CREATE FULLTEXT INDEX search_users    IF NOT EXISTS FOR (u:User)    ON EACH [u.name, u.phone, u.email, u.city];
CREATE FULLTEXT INDEX search_products IF NOT EXISTS FOR (p:Product) ON EACH [p.name, p.brand, p.category];
```

---

## 4. API Design

### 4.1 POST /api/events — Single Event Ingestion

**Request:**
```json
{
  "event_type": "return_initiated",
  "user_id": "user_priya_001",
  "session_id": "sess_abc123",
  "timestamp": "2026-04-05T14:30:00Z",
  "status": "exception",
  "amount": 8499,
  "channel": "app",
  "properties": {
    "reason": "size_runs_small",
    "day_since_purchase": 37,
    "exception": true,
    "exception_reason": "Gold tier + high LTV + first late return"
  },
  "product": {
    "product_id": "nike_air_max_001",
    "name": "Nike Air Max",
    "category": "Footwear",
    "brand": "Nike",
    "price": 8499
  },
  "payment": {
    "method": "COD",
    "amount": 8499,
    "status": "refund_pending"
  },
  "agent": {
    "agent_id": "agent_ravi_001",
    "name": "Ravi K.",
    "action": "approved_exception"
  },
  "policy": {
    "policy_id": "return_policy_v3.2",
    "name": "Return Policy",
    "version": "v3.2",
    "applied": true,
    "exception": true
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "event_id": "evt_uuid_here",
  "nodes_created": ["Event", "Product", "Payment"],
  "relationships_created": 6,
  "timestamp": "2026-04-05T14:30:00Z"
}
```

**Cypher Executed:**
```cypher
// 1. Merge user (create if not exists)
MERGE (u:User {user_id: $user_id})

// 2. Create event node
CREATE (e:Event {
  id: $event_id,
  event_type: $event_type,
  timestamp: datetime($timestamp),
  status: $status,
  amount: $amount,
  channel: $channel,
  exception: $exception,
  exception_reason: $exception_reason,
  properties: $properties,
  created_at: datetime()
})

// 3. Link user → event
CREATE (u)-[:PERFORMED {at: datetime($timestamp)}]->(e)

// 4. Merge product + link
MERGE (p:Product {product_id: $product_id})
  ON CREATE SET p.name = $product_name,
               p.category = $product_category,
               p.brand = $product_brand,
               p.price = $product_price
CREATE (e)-[:INVOLVES]->(p)

// 5. Create payment + link
CREATE (pay:Payment {
  payment_id: $payment_id,
  method: $payment_method,
  amount: $payment_amount,
  status: $payment_status
})
CREATE (e)-[:PAID_VIA]->(pay)

// 6. Merge agent + link
MERGE (a:Agent {agent_id: $agent_id})
  ON CREATE SET a.name = $agent_name
CREATE (e)-[:HANDLED_BY]->(a)

// 7. Merge policy + link
MERGE (pol:Policy {policy_id: $policy_id})
  ON CREATE SET pol.name = $policy_name,
               pol.version = $policy_version
CREATE (e)-[:GOVERNED_BY]->(pol)

// 8. Link to previous event (sequential chain)
WITH u, e
OPTIONAL MATCH (u)-[:PERFORMED]->(prev:Event)
  WHERE prev.timestamp < e.timestamp AND prev.id <> e.id
WITH e, prev ORDER BY prev.timestamp DESC LIMIT 1
FOREACH (_ IN CASE WHEN prev IS NOT NULL THEN [1] ELSE [] END |
  CREATE (prev)-[:NEXT]->(e)
)
```

### 4.2 POST /api/events/batch — Bulk Ingestion

**Request:**
```json
{
  "events": [
    { /* same schema as single event */ },
    { /* ... */ }
  ]
}
```

**Validation:** Max 1000 events per batch. Same Zod schema per event.

**Implementation:** Uses `UNWIND $events AS evt` to process in a single transaction.

### 4.3 POST /api/search — Universal Smart Search

**Request:**
```json
{
  "query": "Gold tier customers who returned Nike products via COD",
  "limit": 50,
  "time_range": {
    "from": "2026-03-01T00:00:00Z",
    "to": "2026-04-08T23:59:59Z"
  }
}
```

**Processing Pipeline:**

```
Step 1: Query → Groq LLM
─────────────────────────
System prompt includes:
  - Full graph schema (node labels, properties, relationships)
  - List of valid enum values (tiers, event_types, categories, etc.)
  - Example Cypher queries for common patterns
  - Instructions to return ONLY valid Cypher

User prompt:
  "Translate this search to a Cypher query: {user_query}"

Step 2: LLM → Cypher
─────────────────────
LLM returns:
  MATCH (u:User {tier: "Gold"})-[:PERFORMED]->(e:Event {event_type: "return_initiated"})
        -[:INVOLVES]->(p:Product {brand: "Nike"}),
        (e)-[:PAID_VIA]->(pay:Payment {method: "COD"})
  WHERE e.timestamp >= datetime("2026-03-01")
    AND e.timestamp <= datetime("2026-04-08")
  RETURN u, e, p, pay
  ORDER BY e.timestamp DESC
  LIMIT 50

Step 3: Validate Cypher
────────────────────────
  - Check for dangerous operations (no DELETE, DETACH, DROP, CREATE, SET, MERGE)
  - Only allow read queries (MATCH, RETURN, WHERE, ORDER, LIMIT, OPTIONAL MATCH)
  - Verify referenced labels exist in schema
  - Reject if validation fails → return error to user

Step 4: Execute against Neo4j
─────────────────────────────
  Run validated Cypher, collect results

Step 5: Transform for frontend
──────────────────────────────
  Convert Neo4j records → { nodes: Node[], edges: Edge[], timeline: TimelineEvent[] }
```

**Response (200):**
```json
{
  "query": "Gold tier customers who returned Nike products via COD",
  "cypher": "MATCH (u:User {tier: 'Gold'})...",
  "results": {
    "nodes": [
      {
        "id": "user_priya_001",
        "label": "User",
        "properties": { "name": "Priya M.", "tier": "Gold", "city": "Bangalore" }
      },
      {
        "id": "evt_uuid_123",
        "label": "Event",
        "properties": { "event_type": "return_initiated", "status": "exception", "amount": 8499 }
      }
    ],
    "edges": [
      { "source": "user_priya_001", "target": "evt_uuid_123", "type": "PERFORMED" }
    ],
    "timeline": [
      { "date": "2026-04-05", "events": [...], "count": 3, "total_amount": 18750 }
    ],
    "summary": {
      "total_nodes": 24,
      "total_edges": 31,
      "node_breakdown": { "User": 5, "Event": 8, "Product": 4, "Payment": 5, "Policy": 1, "Agent": 1 }
    }
  }
}
```

### 4.4 POST /api/graph/explore — Node Re-Center

Called when a user clicks a node to make it the new center.

**Request:**
```json
{
  "node_id": "user_priya_001",
  "node_label": "User",
  "depth": 2,
  "limit": 50
}
```

**Cypher Generated:**
```cypher
// Fetch the center node + all nodes within 2 hops
MATCH path = (center {user_id: $node_id})-[*1..2]-(connected)
WHERE center:User
RETURN nodes(path) AS nodes, relationships(path) AS rels
LIMIT 50
```

**Response:** Same `{ nodes, edges, timeline }` format as /api/search.

### 4.5 POST /api/insights — LLM Analysis with Reasoning Chain

**Request:**
```json
{
  "context": {
    "query": "Nike return rate",
    "nodes": [ /* current visible nodes */ ],
    "edges": [ /* current visible edges */ ]
  },
  "question": "analyze"
}
```

**Processing:**
```
Step 1: Serialize graph context to structured text
─────────────────────────────────────────────────
  "5 users returned Nike Air Max in the last 30 days.
   4 out of 5 cited 'size runs small'. 3 were Gold tier.
   3 returns were policy exceptions (Day 31-37).
   Agent Ravi approved all 3 exceptions.
   Policy v3.2 states 30-day window.
   4 of 5 customers made another purchase within 60 days."

Step 2: Send to Groq with reasoning-chain system prompt
───────────────────────────────────────────────────────
  "You are an analytics expert analyzing a context graph.
   Return a JSON response with exactly three sections:

   1. context: what data you are looking at
      - summary (1 sentence)
      - data_points (array of specific facts from the graph)
      - graph_scope (node/edge counts)

   2. reasoning: step-by-step logical chain (array of objects)
      - Each step has: step number, observation, implication
      - Be specific — reference actual numbers, not vague claims
      - Show HOW you got from data to conclusion

   3. result: the final output
      - finding (what you concluded)
      - recommendation (what to do about it)
      - confidence (0-1 score)
      - impact (estimated effect of the recommendation)

   This chain must be transparent enough that a human can
   verify each step, identify flawed reasoning, and debug
   incorrect conclusions."
```

**Response (200):**
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

### 4.6 GET /api/users/[id]/events — User Timeline

**Request:** `GET /api/users/user_priya_001/events`

**Cypher:**
```cypher
MATCH (u:User {user_id: $user_id})-[:PERFORMED]->(e:Event)
OPTIONAL MATCH (e)-[:INVOLVES]->(p:Product)
OPTIONAL MATCH (e)-[:PAID_VIA]->(pay:Payment)
OPTIONAL MATCH (e)-[:HANDLED_BY]->(a:Agent)
OPTIONAL MATCH (e)-[:GOVERNED_BY]->(pol:Policy)
OPTIONAL MATCH (e)-[:RESULTED_IN]->(o:Outcome)
RETURN u, e, p, pay, a, pol, o
ORDER BY e.timestamp ASC
```

**Response:** Full user profile + all events with their connected nodes.

---

## 5. Service Layer Implementation

### 5.1 Cypher Generator (lib/cypher-generator.ts)

```typescript
interface CypherResult {
  cypher: string;
  params: Record<string, unknown>;
  isValid: boolean;
  error?: string;
}

async function generateCypher(query: string, timeRange?: TimeRange): Promise<CypherResult>
```

**System Prompt Template:**
```
You are a Neo4j Cypher query generator for a retail context graph.

GRAPH SCHEMA:
- (:User {user_id, name, phone, email, tier, city, ltv})
- (:Event {id, event_type, timestamp, status, amount, channel, exception})
- (:Product {product_id, name, category, brand, price})
- (:Session {session_id, device, os, browser, location})
- (:Policy {policy_id, name, version, rule_summary})
- (:Agent {agent_id, name, role, team})
- (:Payment {payment_id, method, amount, status})
- (:Outcome {outcome_id, type, value, description})

RELATIONSHIPS:
- (User)-[:PERFORMED]->(Event)
- (Event)-[:NEXT]->(Event)
- (Event)-[:INVOLVES]->(Product)
- (Event)-[:PAID_VIA]->(Payment)
- (Event)-[:GOVERNED_BY]->(Policy)
- (Event)-[:HANDLED_BY]->(Agent)
- (Event)-[:RESULTED_IN]->(Outcome)
- (User)-[:HAS_SESSION]->(Session)
- (Session)-[:CONTAINS]->(Event)

VALID EVENT TYPES:
app_install, page_view, product_view, search, add_to_cart,
remove_from_cart, begin_checkout, add_payment_info, purchase,
delivery_scheduled, delivery_completed, return_initiated,
return_completed, refund_issued, support_ticket, review_submitted

VALID TIERS: Bronze, Silver, Gold, Platinum
VALID PAYMENT METHODS: COD, UPI, Credit Card, Debit Card
VALID CATEGORIES: Footwear, Apparel, Accessories

RULES:
1. Return ONLY a valid Cypher READ query (MATCH/RETURN/WHERE/ORDER/LIMIT)
2. Never use DELETE, DETACH, DROP, CREATE, SET, MERGE, REMOVE
3. Always include LIMIT (default 50)
4. Return full nodes, not just properties — so frontend can render the graph
5. Use datetime() for timestamp comparisons
6. For aggregation queries, return both individual results AND summary stats
7. If query is ambiguous, interpret broadly (return more, not less)

EXAMPLE QUERIES:
- "Priya" →
  MATCH (u:User) WHERE u.name CONTAINS "Priya" OR u.user_id CONTAINS "Priya"
  OPTIONAL MATCH (u)-[:PERFORMED]->(e:Event)
  OPTIONAL MATCH (e)-[:INVOLVES]->(p:Product)
  RETURN u, e, p ORDER BY e.timestamp ASC LIMIT 50

- "COD refunds Bangalore" →
  MATCH (u:User {city: "Bangalore"})-[:PERFORMED]->(e:Event {event_type: "refund_issued"})
        -[:PAID_VIA]->(pay:Payment {method: "COD"})
  RETURN u, e, pay ORDER BY e.timestamp DESC LIMIT 50

- "shoes category last 7 days" →
  MATCH (e:Event)-[:INVOLVES]->(p:Product {category: "Footwear"})
  WHERE e.timestamp >= datetime() - duration("P7D")
  OPTIONAL MATCH (u:User)-[:PERFORMED]->(e)
  RETURN u, e, p ORDER BY e.timestamp DESC LIMIT 50

Now translate this user query into a Cypher query:
"{user_query}"
```

**Cypher Validation (safety check):**
```typescript
const BLOCKED_KEYWORDS = [
  'DELETE', 'DETACH', 'DROP', 'CREATE', 'SET',
  'MERGE', 'REMOVE', 'CALL', 'LOAD CSV', 'FOREACH'
];

function validateCypher(cypher: string): { valid: boolean; error?: string } {
  const upper = cypher.toUpperCase();
  for (const keyword of BLOCKED_KEYWORDS) {
    if (upper.includes(keyword)) {
      return { valid: false, error: `Blocked operation: ${keyword}` };
    }
  }
  if (!upper.includes('LIMIT')) {
    return { valid: false, error: 'Missing LIMIT clause' };
  }
  return { valid: true };
}
```

### 5.2 Graph Mapper (lib/graph-mapper.ts)

Transforms Neo4j results into React Flow nodes and edges.

```typescript
interface GraphNode {
  id: string;
  label: string;            // "User" | "Event" | "Product" | etc.
  properties: Record<string, unknown>;
  displayName: string;       // Human-readable label for the node
  color: string;             // Based on node label
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;              // "PERFORMED" | "INVOLVES" | etc.
  properties: Record<string, unknown>;
}

interface TimelineEntry {
  date: string;              // ISO date
  events: GraphNode[];
  count: number;
  totalAmount: number;
  topEventType: string;
}

interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  timeline: TimelineEntry[];
  centerNodeId: string;      // Which node to center the graph on
}

function mapNeo4jToGraph(records: Record[], query: string): GraphResult
```

**Node Positioning Strategy:**
```
Center node: position (0, 0)

Connected nodes arranged in concentric circles:
  - 1st hop: radius 300px, evenly spaced
  - 2nd hop: radius 600px, evenly spaced around their parent

Node sizes:
  - Center node: 160x80px
  - 1st hop: 140x70px
  - 2nd hop: 120x60px
```

**Color Map:**
```typescript
const NODE_COLORS: Record<string, string> = {
  User:    '#10b981',  // emerald
  Event:   '#3b82f6',  // blue
  Product: '#8b5cf6',  // purple
  Session: '#6366f1',  // indigo
  Policy:  '#eab308',  // yellow
  Agent:   '#14b8a6',  // teal
  Payment: '#f97316',  // orange
  Outcome: '#ef4444',  // red
};
```

### 5.3 Groq Client (lib/groq.ts)

```typescript
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: options?.temperature ?? 0.1,   // Low temp for Cypher gen
    max_tokens: options?.maxTokens ?? 1024,
  });
  return response.choices[0]?.message?.content || '';
}
```

---

## 6. Frontend Components

### 6.1 Dashboard Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ContextMesh                              [Analyze] [Export] │
├──────────────────────────────────────────────────────────────┤
│  🔍 [Universal Search Bar ................................] │
│  [Tier ▾] [City ▾] [Category ▾] [Status ▾] [Date Range ▾]  │
├─────────────────────────────────┬────────────────────────────┤
│                                 │                            │
│                                 │    EVENT TIMELINE          │
│     CONTEXT GRAPH               │                            │
│     (React Flow)                │    Apr 1 ── 1,247 views   │
│                                 │    Apr 2 ── 342 carts     │
│     Interactive, zoomable,      │    Apr 3 ── 89 purchases  │
│     click-to-recenter           │    Apr 4 ── EORS spike    │
│                                 │    Apr 5 ── 12 returns    │
│                                 │                            │
│                                 │                            │
├─────────────────────────────────┴────────────────────────────┤
│  NODE DETAIL PANEL (slides up/right on node click)           │
│  Properties | Connected Nodes | LLM Insight                  │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Component Specifications

#### SearchBar.tsx
- Single text input, full width
- Debounced (300ms) — does NOT auto-search, requires Enter or click
- Shows loading spinner during LLM + query execution
- Below input: filter chips for quick refinements
- Displays the generated Cypher in a collapsible "Query" section (for power users/demo)

#### ContextGraph.tsx
- React Flow canvas, dark background (#030712)
- Nodes rendered with custom node components per label type
- Each node shows: icon + displayName + 1-2 key properties
- Center node has a subtle glow/ring
- Edges: animated dashed lines with relationship type labels
- On node click: (1) show detail panel, (2) double-click to re-center
- Minimap in bottom-right corner
- Controls (zoom in/out/fit) in bottom-left

#### EventTimeline.tsx
- Vertical timeline, left-aligned
- Each entry: date marker + event summary card
- Cards show: event type, count, key metric (amount/rate)
- Clickable — clicking a timeline entry highlights corresponding graph nodes
- Color-coded dots matching node colors
- Aggregation: by day (default), by hour (if range < 3 days)

#### NodeDetail.tsx
- Slide-out panel (right side, 400px wide)
- Header: node type icon + display name
- Body: all properties in key-value format
- Section: "Connected Nodes" — list of directly connected nodes with relationship type
- Button: "Make Center Node" — triggers re-center
- Button: "Analyze" — triggers LLM insight for this specific node

#### InsightPanel.tsx
- Appears below the graph/timeline area
- Shows markdown-formatted LLM response
- Sections: Key Finding, Pattern, Recommendation
- Loading state with skeleton animation
- "Regenerate" button

#### FilterBar.tsx
- Horizontal row of dropdown filters below search bar
- Filters: Tier, City, Category, Brand, Payment Method, Status, Date Range
- Applying a filter re-runs the search with added constraints
- Active filters shown as removable chips

---

## 7. Seed Data Design

### 7.1 User Profiles (50 users)

Distribution:
- **Tier:** 10 Platinum, 15 Gold, 15 Silver, 10 Bronze
- **City:** 15 Bangalore, 12 Mumbai, 10 Delhi, 8 Chennai, 5 Hyderabad
- **LTV range:** Rs.10K (Bronze) to Rs.5L (Platinum)

### 7.2 Product Catalog (20 products)

| Category | Products | Brands |
|---|---|---|
| Footwear (8) | Air Max, Ultraboost, RS-X, Chuck Taylor, etc. | Nike, Adidas, Puma, Converse |
| Apparel (8) | Denim Jacket, Polo Shirt, Hoodie, etc. | Levis, U.S. Polo, H&M, Zara |
| Accessories (4) | Watch, Sunglasses, Backpack, Wallet | Fossil, Ray-Ban, Wildcraft, Tommy |

### 7.3 Journey Templates

**Template A: Happy Path (40% of users)**
```
app_install → page_view (×3) → product_view (×2) → add_to_cart
→ begin_checkout → add_payment_info → purchase → delivery_scheduled
→ delivery_completed → review_submitted
```

**Template B: Cart Abandonment (20% of users)**
```
page_view (×5) → product_view (×3) → add_to_cart → remove_from_cart
→ page_view (×2) → add_to_cart → begin_checkout → [drops off]
```

**Template C: Return + Refund (25% of users)**
```
...purchase → delivery_completed → return_initiated
→ return_completed → refund_issued
Variants: within policy, exception (Day 31-45), denied
```

**Template D: Support Escalation (15% of users)**
```
...purchase → delivery_completed → support_ticket
→ support_ticket (follow-up) → return_initiated → refund_issued
```

### 7.4 Embedded Patterns (for LLM to discover)

1. **Nike sizing issue:** 60% of Nike Footwear returns cite "size_runs_small"
2. **Gold tier exceptions:** 70% of policy exceptions granted to Gold/Platinum
3. **EORS spike:** Events on Apr 4-6 have 3x volume (sale period)
4. **COD + returns correlation:** COD orders have 40% higher return rate
5. **Agent Ravi pattern:** Agent Ravi approves exceptions 85% of the time (team avg: 55%)
6. **Bangalore high returns:** Bangalore has 30% higher return rate than other cities
7. **Price sensitivity:** Users who abandon cart return when price drops > 20%

### 7.5 Policies (seeded)

| Policy | Version | Rule |
|---|---|---|
| Return Policy | v3.2 | 30-day window, unused product, original packaging |
| Refund Policy | v2.1 | 7-day processing, original payment method |
| Exception Policy | v1.0 | Manager approval for >30 days, Gold+ auto-approve |
| COD Policy | v4.0 | Available for orders under Rs.15,000 |

### 7.6 Agents (seeded)

| Agent | Role | Team | Pattern |
|---|---|---|---|
| Ravi K. | L2 Support | Returns | High exception approval (85%) |
| Anita S. | L1 Support | General | Follows policy strictly (20% exception) |
| Deepak M. | L2 Support | Returns | Moderate (55% exception) |
| Priya R. | L1 Support | General | Escalates often to L2 |
| Vikram T. | Manager | Returns | Final approver for denied exceptions |

---

## 8. Data Flow Sequences

### 8.1 Event Ingestion

```
Client                    API                    Neo4j
  │                        │                       │
  ├─ POST /api/events ────▶│                       │
  │                        ├─ Zod validate ────┐   │
  │                        │◀─── valid ────────┘   │
  │                        │                       │
  │                        ├─ Generate UUIDs       │
  │                        │  (event, payment, etc)│
  │                        │                       │
  │                        ├─ Build Cypher ────────▶│
  │                        │  MERGE User           │
  │                        │  CREATE Event         │
  │                        │  MERGE Product        │
  │                        │  CREATE Payment       │
  │                        │  CREATE relationships │
  │                        │  Link NEXT to prev    │
  │                        │◀── success ───────────┤
  │                        │                       │
  │◀── 201 { event_id } ──┤                       │
```

### 8.2 Universal Search

```
User                   API                   Groq              Neo4j
  │                     │                      │                  │
  ├─ POST /api/search ─▶│                      │                  │
  │  { query: "..." }   │                      │                  │
  │                     ├─ Build prompt ───────▶│                  │
  │                     │  (schema + query)     │                  │
  │                     │                      ├─ Generate        │
  │                     │                      │  Cypher          │
  │                     │◀── cypher string ────┤                  │
  │                     │                      │                  │
  │                     ├─ Validate Cypher     │                  │
  │                     │  (no mutations)      │                  │
  │                     │                      │                  │
  │                     ├─ Execute Cypher ─────────────────────▶│
  │                     │                                       │
  │                     │◀── Neo4j records ────────────────────┤
  │                     │                                       │
  │                     ├─ mapNeo4jToGraph()   │                  │
  │                     │  nodes, edges,       │                  │
  │                     │  timeline            │                  │
  │                     │                      │                  │
  │◀── 200 { results } ┤                      │                  │
  │                     │                      │                  │
  ├─ Render graph ──┐   │                      │                  │
  │  + timeline     │   │                      │                  │
  │◀────────────────┘   │                      │                  │
```

### 8.3 Node Re-Center (Click Exploration)

```
User clicks node          API                      Neo4j
  │                        │                         │
  ├─ POST /graph/explore ─▶│                         │
  │  { node_id, label,     │                         │
  │    depth: 2 }          │                         │
  │                        ├─ Build traversal query ─▶│
  │                        │  MATCH path=(center)    │
  │                        │    -[*1..2]-(connected) │
  │                        │◀── results ─────────────┤
  │                        │                         │
  │                        ├─ mapNeo4jToGraph()      │
  │                        │  (center = clicked node)│
  │                        │                         │
  │◀── 200 { results } ───┤                         │
  │                        │                         │
  ├─ Animate graph ──┐     │                         │
  │  transition      │     │                         │
  │◀─────────────────┘     │                         │
```

---

## 9. Error Handling

| Scenario | Handling |
|---|---|
| Invalid event payload | 400 + Zod error details |
| Neo4j connection failure | 500 + retry once + log |
| Groq generates invalid Cypher | Retry with refined prompt (1 attempt), then fallback to structured search |
| Groq API timeout (>5s) | Return cached/pre-computed result for common queries, or error with suggestion |
| Cypher validation fails (mutation detected) | 400 + "Query blocked for safety" |
| Empty search results | 200 + empty graph + "No results found. Try broadening your search." |
| Node re-center on deleted node | 404 + "Node no longer exists" |
| Rate limit exceeded | 429 + retry-after header |

### Fallback: Structured Search

If LLM-to-Cypher fails, fall back to deterministic search:

```typescript
function structuredSearch(query: string): string {
  // Pattern match common query shapes
  // "user_id" or phone number → User lookup
  // Known event type → Event filter
  // Known category/brand → Product filter
  // Combine with AND logic
  // Returns a safe, deterministic Cypher query
}
```

---

## 10. Performance Targets

| Metric | Target | How |
|---|---|---|
| Event ingestion (single) | < 200ms | Direct Cypher, no LLM involved |
| Event ingestion (batch 1000) | < 2s | UNWIND batch processing |
| Search (LLM + query) | < 3s | Groq ~0.5s + Neo4j ~0.5s + overhead |
| Node re-center | < 1s | Pre-built traversal query, no LLM |
| LLM insight generation | < 3s | Groq with graph context |
| Graph render (50 nodes) | < 500ms | React Flow with memoized layout |
| Graph render (100 nodes) | < 1s | Progressive loading if needed |

---

## 11. Security Considerations

| Concern | Mitigation |
|---|---|
| **Cypher injection via search** | LLM output validated — only read operations allowed. Blocked keyword list. Parameterized fallback queries. |
| **API abuse** | Rate limiting on all endpoints. Zod validation on all inputs. |
| **Env secrets exposure** | .env.local gitignored. Server-side only access to Neo4j/Groq credentials. |
| **XSS via event properties** | All user-supplied data rendered via React (auto-escaped). No dangerouslySetInnerHTML. |
| **LLM prompt injection via event data** | Event properties are JSON-stringified and treated as data, never injected into prompts as instructions. |

---

## 12. Deployment

```
┌─────────────────────┐         ┌─────────────────────┐
│     Vercel           │         │   Neo4j Aura        │
│                      │         │   (Free Tier)       │
│  Next.js App         │────────▶│                     │
│  - Dashboard         │   bolt  │  Graph Database     │
│  - API Routes        │   +s    │  - 200K nodes       │
│  - Serverless Fns    │         │  - 400K rels        │
│                      │         │                     │
└──────────┬───────────┘         └─────────────────────┘
           │
           │  HTTPS
           ▼
┌─────────────────────┐
│   Groq Cloud API    │
│   llama-3.3-70b     │
└─────────────────────┘
```

**Vercel Config:**
- Environment variables: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, GROQ_API_KEY
- Region: iad1 (US East) — closest to Neo4j Aura
- Function timeout: 30s (for LLM calls)

**Neo4j Aura Free Tier Limits:**
- 200K nodes, 400K relationships
- 1 database
- Sufficient for hackathon demo (50 users × ~15 events = ~2K nodes)
