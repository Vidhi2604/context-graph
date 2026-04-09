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
│                      AUTH LAYER (NextAuth.js)                     │
│                                                                   │
│  Google OAuth · Email/Password · Session JWT · Org Scope          │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      PLAN GATING MIDDLEWARE                        │
│                                                                   │
│  Check org.plan → gate features (search type, node limit, etc.)  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      API LAYER (Next.js App Router)               │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ /api/auth    │  │ /api/search  │  │ /api/profiles/[id]     │  │
│  │ /api/org     │  │ /api/events  │  │ /api/graph/explore     │  │
│  │ /api/plan    │  │ /api/events  │  │ /api/insights          │  │
│  │ /api/alerts  │  │   /batch     │  │ /api/patterns/discover │  │
│  │ /api/stats   │  │              │  │ /api/search/similar    │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘  │
└─────────┼─────────────────┼──────────────────────┼───────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                      EVENT STREAMING LAYER                        │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  Upstash Kafka (Serverless)                 │  │
│  │                                                             │  │
│  │  Topic: events-{tenantId}                                   │  │
│  │  Producers: /api/events, /api/events/batch, /api/events/transcript │  │
│  │  Consumer: background event processor                       │  │
│  │                                                             │  │
│  │  Flow: API validates → produces to Kafka → API returns 202  │  │
│  │        Consumer polls → identity resolution → graph write   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                                │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Event        │  │ Query Engine │  │ Insight Engine         │  │
│  │ Consumer     │  │ (LLM→Cypher)│  │ (LLM Reasoning Chain) │  │
│  │ (Kafka→Neo4j)│  │              │  │                        │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Vertical     │  │ Tenant       │  │ Plan                   │  │
│  │ Registry     │  │ Manager      │  │ Manager                │  │
│  │ (schema map) │  │ (scoping)    │  │ (feature flags)        │  │
│  └──────────────┘  └──────────────┘  └────────────────────────┘  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Identity     │  │ Commitment   │  │ Alert                  │  │
│  │ Resolver     │  │ Tracker      │  │ Engine                 │  │
│  └──────────────┘  └──────────────┘  └────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                   │
│                                                                   │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐  │
│  │     Neo4j (Aura)         │  │     Groq LLM API            │  │
│  │     Graph + Vector       │  │     llama-3.3-70b-versatile  │  │
│  │     Tenant-scoped        │  │                              │  │
│  └──────────────────────────┘  └──────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────┐                                    │
│  │     Upstash Kafka        │                                    │
│  │     Event durability     │                                    │
│  │     Replay capability    │                                    │
│  └──────────────────────────┘                                    │
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
│   │   ├── auth/
│   │   │   ├── signin/page.tsx         # Sign in page
│   │   │   └── signup/page.tsx         # Sign up + org creation
│   │   │
│   │   ├── onboarding/
│   │   │   └── page.tsx                # Vertical selection + setup
│   │   │
│   │   ├── dashboard/
│   │   │   ├── page.tsx                # Main dashboard — search + graph + timeline
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx            # Side B: decision volume, exception rates
│   │   │   ├── policies/
│   │   │   │   └── page.tsx            # Side B: policy drift analysis
│   │   │   ├── agents/
│   │   │   │   └── page.tsx            # Side B: agent/provider performance
│   │   │   └── commitments/
│   │   │       └── page.tsx            # Side B: fulfillment tracking
│   │   │
│   │   ├── settings/
│   │   │   └── page.tsx                # Org settings, plan selector, team
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts        # NextAuth.js handler
│   │       ├── org/
│   │       │   └── route.ts            # POST /api/org — create org
│   │       ├── plan/
│   │       │   └── route.ts            # PUT /api/plan — change plan
│   │       ├── events/
│   │       │   ├── route.ts            # POST /api/events
│   │       │   ├── batch/
│   │       │   │   └── route.ts        # POST /api/events/batch
│   │       │   ├── transcript/
│   │       │   │   └── route.ts        # POST /api/events/transcript — STT ingestion
│   │       │   └── process/
│   │       │       └── route.ts        # POST /api/events/process — Kafka consumer trigger
│   │       ├── search/
│   │       │   ├── route.ts            # POST /api/search
│   │       │   └── similar/
│   │       │       └── route.ts        # POST /api/search/similar
│   │       ├── graph/
│   │       │   └── explore/
│   │       │       └── route.ts        # POST /api/graph/explore
│   │       ├── insights/
│   │       │   └── route.ts            # POST /api/insights
│   │       ├── profiles/
│   │       │   └── [id]/
│   │       │       └── route.ts        # GET /api/profiles/[id]
│   │       ├── patterns/
│   │       │   └── discover/
│   │       │       └── route.ts        # POST /api/patterns/discover
│   │       ├── agent/
│   │       │   └── context/
│   │       │       └── route.ts        # GET /api/agent/context — Side A pre-conv brief
│   │       ├── mcp/
│   │       │   └── route.ts            # POST /api/mcp — MCP server
│   │       ├── alerts/
│   │       │   └── route.ts            # GET /api/alerts
│   │       ├── stats/
│   │       │   └── route.ts            # GET /api/stats — value dashboard
│   │       └── schema/
│   │           └── route.ts            # POST /api/schema
│   │
│   ├── lib/
│   │   ├── neo4j.ts                    # Neo4j driver, session helper
│   │   ├── groq.ts                     # Groq client, prompt builder
│   │   ├── kafka.ts                    # Upstash Kafka producer + consumer
│   │   ├── event-processor.ts          # Kafka consumer → identity resolution → graph write
│   │   ├── transcript-extractor.ts     # LLM: raw transcript → structured events
│   │   ├── cypher-generator.ts         # LLM → Cypher with vertical schema
│   │   ├── graph-mapper.ts             # Neo4j result → React Flow nodes/edges
│   │   ├── identity-resolver.ts        # Profile + Identity resolution engine
│   │   ├── commitment-tracker.ts       # Extract + track commitments from events
│   │   ├── alert-engine.ts             # Policy drift, risk scoring, anomaly detection
│   │   ├── auth.ts                     # NextAuth config
│   │   ├── tenant.ts                   # Tenant scoping helpers
│   │   └── plans.ts                    # Plan definitions + feature gate checks
│   │
│   ├── verticals/
│   │   ├── registry.ts                 # Vertical registry (schema, colors, filters, prompts)
│   │   ├── retail/
│   │   │   ├── schema.ts              # Retail node types, relationships, indexes
│   │   │   ├── seed.ts                # Retail seed data generator
│   │   │   ├── prompt.ts             # Retail-specific LLM prompt (schema + examples)
│   │   │   └── filters.ts            # Retail filter definitions
│   │   └── healthcare/
│   │       ├── schema.ts              # Healthcare node types, relationships, indexes
│   │       ├── seed.ts                # Healthcare seed data generator
│   │       ├── prompt.ts             # Healthcare-specific LLM prompt
│   │       └── filters.ts            # Healthcare filter definitions
│   │
│   ├── types/
│   │   ├── event.ts                    # Zod schemas + TS types for events
│   │   ├── graph.ts                    # Graph node/edge types for frontend
│   │   ├── org.ts                      # Org, tenant, plan types
│   │   └── vertical.ts                # Vertical config type definitions
│   │
│   └── components/
│       ├── SearchBar.tsx               # Universal search input
│       ├── ContextGraph.tsx            # React Flow graph (vertical-aware colors)
│       ├── EventTimeline.tsx           # Chronological timeline view
│       ├── NodeDetail.tsx              # Side panel for node properties
│       ├── InsightPanel.tsx            # LLM insight with reasoning chain display
│       ├── FilterBar.tsx              # Dynamic filters (per vertical)
│       ├── PlanGate.tsx               # Component wrapper for plan-gated features
│       ├── VerticalBadge.tsx          # Shows current vertical (Retail/Healthcare)
│       └── OrgSwitcher.tsx            # Switch between orgs (for demo)
│
├── prisma/
│   └── schema.prisma                   # Org, User, Plan tables (SQLite for hackathon)
│
├── docs/
│   ├── PRD.md
│   └── LLD.md
│
├── .env.local
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

---

## 3. Data Models

### 3.1 Application Data (SQLite via Prisma)

Org, user, and plan data lives in a simple relational DB (SQLite for hackathon, Postgres in prod).

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String?              // hashed, null for OAuth users
  image     String?
  orgs      OrgMember[]
  createdAt DateTime @default(now())
}

model Org {
  id        String      @id @default(cuid())
  name      String                           // "Myntra" or "City Hospital"
  vertical  String                           // "retail" | "healthcare"
  plan      String      @default("starter")  // "starter" | "pro" | "enterprise"
  tenantId  String      @unique              // Used to scope Neo4j queries
  seeded    Boolean     @default(false)      // Has demo data been loaded?
  members   OrgMember[]
  createdAt DateTime    @default(now())
}

model OrgMember {
  id     String @id @default(cuid())
  userId String
  orgId  String
  role   String @default("member")           // "owner" | "admin" | "member"
  user   User   @relation(fields: [userId], references: [id])
  org    Org    @relation(fields: [orgId], references: [id])

  @@unique([userId, orgId])
}
```

### 3.2 Plan Definitions (lib/plans.ts)

```typescript
export const PLANS = {
  starter: {
    name: 'Starter',
    eventsPerMonth: 1000,
    searchType: 'basic',        // text match only
    maxGraphNodes: 25,
    timelineRange: 7,           // days
    insightLevel: 'none',
    apiAccess: false,
    maxMembers: 1,
  },
  pro: {
    name: 'Pro',
    eventsPerMonth: 10000,
    searchType: 'llm',          // full LLM → Cypher
    maxGraphNodes: 100,
    timelineRange: 90,
    insightLevel: 'summary',    // finding + recommendation only
    apiAccess: false,
    maxMembers: 5,
  },
  enterprise: {
    name: 'Enterprise',
    eventsPerMonth: Infinity,
    searchType: 'llm',
    maxGraphNodes: Infinity,
    timelineRange: Infinity,
    insightLevel: 'full',       // full reasoning chain
    apiAccess: true,
    maxMembers: Infinity,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function canUse(plan: PlanId, feature: string): boolean {
  // Check if org's plan allows the feature
}
```

---

## 4. Vertical Registry System

### 4.1 Vertical Config Type (types/vertical.ts)

```typescript
export interface VerticalConfig {
  id: string;                    // "retail" | "healthcare"
  name: string;                  // "Retail" | "Healthcare"
  description: string;
  nodeTypes: NodeTypeConfig[];
  relationships: RelationshipConfig[];
  indexes: string[];             // Cypher CREATE INDEX statements
  constraints: string[];         // Cypher CREATE CONSTRAINT statements
  colors: Record<string, string>;
  filters: FilterConfig[];
  sampleQueries: string[];       // Shown as suggestions in search bar
  cypherPrompt: string;          // LLM system prompt with this vertical's schema
}

export interface NodeTypeConfig {
  label: string;                 // "Patient", "User", etc.
  properties: PropertyConfig[];
  displayName: string;           // Which property to show as node label
  icon: string;                  // Emoji or icon name
}

export interface FilterConfig {
  id: string;
  label: string;                 // "Tier", "Department", etc.
  type: 'select' | 'range' | 'date';
  options?: string[];            // For select type
  cypherField: string;           // Maps to graph property
}
```

### 4.2 Retail Vertical (verticals/retail/schema.ts)

```typescript
export const retailVertical: VerticalConfig = {
  id: 'retail',
  name: 'Retail',
  description: 'E-commerce event tracking and decision intelligence',

  nodeTypes: [
    {
      label: 'User',
      displayName: 'name',
      icon: '👤',
      properties: [
        { name: 'user_id', type: 'string', unique: true },
        { name: 'name', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'tier', type: 'string', enum: ['Bronze', 'Silver', 'Gold', 'Platinum'] },
        { name: 'city', type: 'string' },
        { name: 'ltv', type: 'float' },
      ],
    },
    // Event, Product, Session, Policy, Agent, Payment, Outcome...
  ],

  colors: {
    User: '#10b981',
    Event: '#3b82f6',
    Product: '#8b5cf6',
    Session: '#6366f1',
    Policy: '#eab308',
    Agent: '#14b8a6',
    Payment: '#f97316',
    Outcome: '#ef4444',
  },

  filters: [
    { id: 'tier', label: 'Tier', type: 'select', options: ['Bronze','Silver','Gold','Platinum'], cypherField: 'u.tier' },
    { id: 'city', label: 'City', type: 'select', options: ['Bangalore','Mumbai','Delhi','Chennai','Hyderabad'], cypherField: 'u.city' },
    { id: 'category', label: 'Category', type: 'select', options: ['Footwear','Apparel','Accessories'], cypherField: 'p.category' },
    { id: 'payment', label: 'Payment', type: 'select', options: ['COD','UPI','Credit Card','Debit Card'], cypherField: 'pay.method' },
    { id: 'status', label: 'Status', type: 'select', options: ['completed','pending','exception','denied'], cypherField: 'e.status' },
    { id: 'dateRange', label: 'Date Range', type: 'date', cypherField: 'e.timestamp' },
  ],

  sampleQueries: [
    'Gold tier returns in Bangalore',
    'COD orders above 5000',
    'Nike return rate vs Puma',
    'shoes category last 7 days',
    'checkout dropoffs',
  ],

  // ... constraints, indexes, cypherPrompt
};
```

### 4.3 Healthcare Vertical (verticals/healthcare/schema.ts)

```typescript
export const healthcareVertical: VerticalConfig = {
  id: 'healthcare',
  name: 'Healthcare',
  description: 'Hospital operations, patient journeys, and clinical intelligence',

  nodeTypes: [
    {
      label: 'Patient',
      displayName: 'name',
      icon: '🏥',
      properties: [
        { name: 'patient_id', type: 'string', unique: true },
        { name: 'name', type: 'string' },
        { name: 'age', type: 'integer' },
        { name: 'gender', type: 'string', enum: ['Male', 'Female', 'Other'] },
        { name: 'blood_group', type: 'string' },
        { name: 'city', type: 'string' },
        { name: 'insurance_provider', type: 'string' },
        { name: 'emergency_contact', type: 'string' },
      ],
    },
    {
      label: 'Visit',
      displayName: 'type',
      icon: '📋',
      properties: [
        { name: 'visit_id', type: 'string', unique: true },
        { name: 'type', type: 'string', enum: ['Emergency', 'Outpatient', 'Inpatient', 'Follow-up', 'Surgery'] },
        { name: 'timestamp', type: 'datetime' },
        { name: 'department', type: 'string' },
        { name: 'status', type: 'string', enum: ['Active', 'Discharged', 'Transferred', 'Deceased'] },
        { name: 'priority', type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
        { name: 'duration_hours', type: 'float' },
      ],
    },
    {
      label: 'Diagnosis',
      displayName: 'name',
      icon: '🔬',
      properties: [
        { name: 'diagnosis_id', type: 'string', unique: true },
        { name: 'icd_code', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'severity', type: 'string', enum: ['Critical', 'Severe', 'Moderate', 'Mild'] },
        { name: 'chronic', type: 'boolean' },
      ],
    },
    {
      label: 'Treatment',
      displayName: 'name',
      icon: '💊',
      properties: [
        { name: 'treatment_id', type: 'string', unique: true },
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string', enum: ['Procedure', 'Surgery', 'Therapy', 'Observation'] },
        { name: 'cost', type: 'float' },
        { name: 'duration_hours', type: 'float' },
        { name: 'success', type: 'boolean' },
      ],
    },
    {
      label: 'Medication',
      displayName: 'name',
      icon: '💉',
      properties: [
        { name: 'medication_id', type: 'string', unique: true },
        { name: 'name', type: 'string' },
        { name: 'dosage', type: 'string' },
        { name: 'frequency', type: 'string' },
        { name: 'duration_days', type: 'integer' },
        { name: 'category', type: 'string' },
      ],
    },
    {
      label: 'Provider',
      displayName: 'name',
      icon: '👨‍⚕️',
      properties: [
        { name: 'provider_id', type: 'string', unique: true },
        { name: 'name', type: 'string' },
        { name: 'specialization', type: 'string' },
        { name: 'department', type: 'string' },
        { name: 'experience_years', type: 'integer' },
      ],
    },
    {
      label: 'InsuranceClaim',
      displayName: 'status',
      icon: '📄',
      properties: [
        { name: 'claim_id', type: 'string', unique: true },
        { name: 'amount', type: 'float' },
        { name: 'status', type: 'string', enum: ['Approved', 'Denied', 'Pending', 'Partial'] },
        { name: 'denial_reason', type: 'string' },
        { name: 'payer', type: 'string' },
      ],
    },
    {
      label: 'Protocol',
      displayName: 'name',
      icon: '📑',
      properties: [
        { name: 'protocol_id', type: 'string', unique: true },
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'condition', type: 'string' },
        { name: 'standard_treatment', type: 'string' },
      ],
    },
    {
      label: 'Outcome',
      displayName: 'type',
      icon: '📊',
      properties: [
        { name: 'outcome_id', type: 'string', unique: true },
        { name: 'type', type: 'string', enum: ['Recovered', 'Improved', 'Unchanged', 'Deteriorated', 'Deceased'] },
        { name: 'readmission', type: 'boolean' },
        { name: 'days_to_readmission', type: 'integer' },
        { name: 'follow_up_scheduled', type: 'boolean' },
      ],
    },
    {
      label: 'Department',
      displayName: 'name',
      icon: '🏢',
      properties: [
        { name: 'department_id', type: 'string', unique: true },
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string', enum: ['Clinical', 'Surgical', 'Emergency', 'Diagnostic', 'Support'] },
        { name: 'capacity', type: 'integer' },
      ],
    },
  ],

  colors: {
    Patient: '#10b981',
    Visit: '#3b82f6',
    Diagnosis: '#ef4444',
    Treatment: '#8b5cf6',
    Medication: '#06b6d4',
    Provider: '#14b8a6',
    InsuranceClaim: '#f97316',
    Protocol: '#eab308',
    Outcome: '#ec4899',
    Department: '#6366f1',
  },

  filters: [
    { id: 'department', label: 'Department', type: 'select', options: ['Cardiology','Orthopedics','General Medicine','Emergency','Neurology','Pulmonology'], cypherField: 'v.department' },
    { id: 'priority', label: 'Priority', type: 'select', options: ['Critical','High','Medium','Low'], cypherField: 'v.priority' },
    { id: 'severity', label: 'Severity', type: 'select', options: ['Critical','Severe','Moderate','Mild'], cypherField: 'd.severity' },
    { id: 'claimStatus', label: 'Claim Status', type: 'select', options: ['Approved','Denied','Pending','Partial'], cypherField: 'ic.status' },
    { id: 'visitType', label: 'Visit Type', type: 'select', options: ['Emergency','Outpatient','Inpatient','Follow-up','Surgery'], cypherField: 'v.type' },
    { id: 'dateRange', label: 'Date Range', type: 'date', cypherField: 'v.timestamp' },
  ],

  sampleQueries: [
    'readmissions within 30 days',
    'Dr. Sharma cardiac patients',
    'insurance denials for knee replacement',
    'diabetic patients on insulin',
    'protocol deviations in ICU',
    'ER wait time > 2 hours',
  ],
};
```

### 4.4 Vertical Registry (verticals/registry.ts)

```typescript
import { retailVertical } from './retail/schema';
import { healthcareVertical } from './healthcare/schema';
import { VerticalConfig } from '@/types/vertical';

const VERTICALS: Record<string, VerticalConfig> = {
  retail: retailVertical,
  healthcare: healthcareVertical,
};

export function getVertical(id: string): VerticalConfig {
  const v = VERTICALS[id];
  if (!v) throw new Error(`Unknown vertical: ${id}`);
  return v;
}

export function getAllVerticals(): VerticalConfig[] {
  return Object.values(VERTICALS);
}
```

Adding a new vertical in the future = add a new folder under `verticals/` with schema, seed, prompt, and filters. Zero core engine changes.

---

## 5. Neo4j Graph Schema

### 5.1 Tenant Scoping

Every node in Neo4j gets a `_tenant` property. All queries are scoped:

```cypher
// Every query includes tenant filter
MATCH (p:Profile {_tenant: $tenantId}) ...
```

Alternative: use separate Neo4j databases per tenant (Aura supports this on paid tier). For hackathon, property-based scoping is simpler.

### 5.2 Shared Schema — Profile + Identity (Both Verticals)

```cypher
// Profile — the canonical unified person (user or patient)
(:Profile {
  profile_id:  String    UNIQUE,     // "prof_abc123"
  name:        String,               // "Priya M." — enriched from best source
  _tenant:     String,               // Tenant scoping
  _vertical:   String,               // "retail" | "healthcare"
  created_at:  DateTime,
  updated_at:  DateTime,

  // Retail-specific (null for healthcare)
  tier:        String,               // "Gold" | "Silver" | "Bronze" | "Platinum"
  city:        String,               // "Bangalore"
  ltv:         Float,                // 120000.0

  // Healthcare-specific (null for retail)
  age:                Integer,
  gender:             String,        // "Male" | "Female" | "Other"
  blood_group:        String,
  insurance_provider: String
})

// Identity — any identifier that resolves to a Profile
(:Identity {
  identity_id: String    UNIQUE,     // "ident_xyz789"
  type:        String,               // "email" | "phone" | "device" | "cookie" | "mrn" | "aadhaar" | "crm_id"
  value:       String,               // "priya@gmail.com" | "9876543210" | "MH-4829"
  source:      String,               // "web_sdk" | "app_sdk" | "crm" | "hospital_ehr"
  verified:    Boolean,              // true for email/phone verified, false for cookie/device
  strength:    String,               // "strong" | "medium" | "weak"
  first_seen:  DateTime,
  _tenant:     String
})

// Relationship
(Profile)-[:HAS_IDENTITY]->(Identity)
```

**Indexes & Constraints:**
```cypher
// Profile
CREATE CONSTRAINT profile_id     IF NOT EXISTS FOR (p:Profile)  REQUIRE p.profile_id IS UNIQUE;
CREATE INDEX profile_tenant      IF NOT EXISTS FOR (p:Profile)  ON (p._tenant);
CREATE INDEX profile_name        IF NOT EXISTS FOR (p:Profile)  ON (p.name);
CREATE FULLTEXT INDEX search_profiles IF NOT EXISTS FOR (p:Profile) ON EACH [p.name, p.city];

// Identity — composite uniqueness (type + value + tenant)
CREATE CONSTRAINT identity_id    IF NOT EXISTS FOR (i:Identity) REQUIRE i.identity_id IS UNIQUE;
CREATE INDEX identity_lookup     IF NOT EXISTS FOR (i:Identity) ON (i.type, i.value, i._tenant);
CREATE INDEX identity_value      IF NOT EXISTS FOR (i:Identity) ON (i.value);
```

### 5.3 Retail Schema — Indexes & Constraints

```cypher
// Unique constraints
CREATE CONSTRAINT retail_event_id     IF NOT EXISTS FOR (e:Event)   REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT retail_product_id   IF NOT EXISTS FOR (p:Product) REQUIRE p.product_id IS UNIQUE;
CREATE CONSTRAINT retail_session_id   IF NOT EXISTS FOR (s:Session) REQUIRE s.session_id IS UNIQUE;
CREATE CONSTRAINT retail_policy_id    IF NOT EXISTS FOR (p:Policy)  REQUIRE p.policy_id IS UNIQUE;
CREATE CONSTRAINT retail_agent_id     IF NOT EXISTS FOR (a:Agent)   REQUIRE a.agent_id IS UNIQUE;
CREATE CONSTRAINT retail_payment_id   IF NOT EXISTS FOR (p:Payment) REQUIRE p.payment_id IS UNIQUE;
CREATE CONSTRAINT retail_outcome_id   IF NOT EXISTS FOR (o:Outcome) REQUIRE o.outcome_id IS UNIQUE;

// Search indexes
CREATE INDEX event_type       IF NOT EXISTS FOR (e:Event)   ON (e.event_type);
CREATE INDEX event_timestamp  IF NOT EXISTS FOR (e:Event)   ON (e.timestamp);
CREATE INDEX event_status     IF NOT EXISTS FOR (e:Event)   ON (e.status);
CREATE INDEX product_category IF NOT EXISTS FOR (p:Product) ON (p.category);
CREATE INDEX product_brand    IF NOT EXISTS FOR (p:Product) ON (p.brand);
CREATE INDEX payment_method   IF NOT EXISTS FOR (p:Payment) ON (p.method);

// Full-text search
CREATE FULLTEXT INDEX search_retail_products IF NOT EXISTS FOR (p:Product) ON EACH [p.name, p.brand, p.category];
```

**Retail Relationships:**
```cypher
(Profile)-[:HAS_IDENTITY]->(Identity)
(Profile)-[:PERFORMED {at: DateTime}]->(Event)
(Profile)-[:HAS_SESSION]->(Session)
(Event)-[:NEXT]->(Event)
(Event)-[:INVOLVES]->(Product)
(Event)-[:PAID_VIA]->(Payment)
(Event)-[:GOVERNED_BY]->(Policy)
(Event)-[:HANDLED_BY]->(Agent)
(Event)-[:RESULTED_IN]->(Outcome)
(Session)-[:CONTAINS]->(Event)
```

### 5.4 Healthcare Schema — Indexes & Constraints

```cypher
// Unique constraints
CREATE CONSTRAINT hc_visit_id       IF NOT EXISTS FOR (v:Visit)          REQUIRE v.visit_id IS UNIQUE;
CREATE CONSTRAINT hc_diagnosis_id   IF NOT EXISTS FOR (d:Diagnosis)      REQUIRE d.diagnosis_id IS UNIQUE;
CREATE CONSTRAINT hc_treatment_id   IF NOT EXISTS FOR (t:Treatment)      REQUIRE t.treatment_id IS UNIQUE;
CREATE CONSTRAINT hc_medication_id  IF NOT EXISTS FOR (m:Medication)     REQUIRE m.medication_id IS UNIQUE;
CREATE CONSTRAINT hc_provider_id    IF NOT EXISTS FOR (pr:Provider)      REQUIRE pr.provider_id IS UNIQUE;
CREATE CONSTRAINT hc_claim_id       IF NOT EXISTS FOR (ic:InsuranceClaim) REQUIRE ic.claim_id IS UNIQUE;
CREATE CONSTRAINT hc_protocol_id    IF NOT EXISTS FOR (pt:Protocol)      REQUIRE pt.protocol_id IS UNIQUE;
CREATE CONSTRAINT hc_outcome_id     IF NOT EXISTS FOR (o:Outcome)        REQUIRE o.outcome_id IS UNIQUE;
CREATE CONSTRAINT hc_department_id  IF NOT EXISTS FOR (dep:Department)   REQUIRE dep.department_id IS UNIQUE;

// Search indexes
CREATE INDEX visit_type         IF NOT EXISTS FOR (v:Visit)           ON (v.type);
CREATE INDEX visit_department   IF NOT EXISTS FOR (v:Visit)           ON (v.department);
CREATE INDEX visit_timestamp    IF NOT EXISTS FOR (v:Visit)           ON (v.timestamp);
CREATE INDEX visit_priority     IF NOT EXISTS FOR (v:Visit)           ON (v.priority);
CREATE INDEX diagnosis_severity IF NOT EXISTS FOR (d:Diagnosis)       ON (d.severity);
CREATE INDEX diagnosis_icd      IF NOT EXISTS FOR (d:Diagnosis)       ON (d.icd_code);
CREATE INDEX claim_status       IF NOT EXISTS FOR (ic:InsuranceClaim) ON (ic.status);
CREATE INDEX provider_spec      IF NOT EXISTS FOR (pr:Provider)       ON (pr.specialization);

// Full-text search
CREATE FULLTEXT INDEX search_hc_providers IF NOT EXISTS FOR (pr:Provider) ON EACH [pr.name, pr.specialization, pr.department];
CREATE FULLTEXT INDEX search_hc_diagnosis IF NOT EXISTS FOR (d:Diagnosis) ON EACH [d.name, d.icd_code];
```

**Healthcare Relationships:**
```cypher
(Profile)-[:HAS_IDENTITY]->(Identity)
(Profile)-[:HAD_VISIT {at: DateTime}]->(Visit)
(Profile)-[:READMITTED {days_gap: Integer}]->(Visit)
(Visit)-[:DIAGNOSED_WITH]->(Diagnosis)
(Visit)-[:TREATED_WITH]->(Treatment)
(Visit)-[:PRESCRIBED]->(Medication)
(Visit)-[:ATTENDED_BY]->(Provider)
(Visit)-[:GOVERNED_BY]->(Protocol)
(Visit)-[:RESULTED_IN]->(Outcome)
(Visit)-[:CLAIMED_VIA]->(InsuranceClaim)
(Visit)-[:IN_DEPARTMENT]->(Department)
(Visit)-[:NEXT]->(Visit)
(Diagnosis)-[:INDICATES]->(Treatment)
(Treatment)-[:USES]->(Medication)
(Provider)-[:BELONGS_TO]->(Department)
```

### 5.5 Identity Resolution Engine (lib/identity-resolver.ts)

```typescript
interface ResolveResult {
  profileId: string;
  isNew: boolean;
  merged: boolean;          // true if two profiles were merged
  mergedFromIds?: string[]; // profile IDs that were merged into this one
}

async function resolveIdentity(
  identifiers: { type: string; value: string; source: string }[],
  tenantId: string,
  profileData?: Partial<ProfileData>
): Promise<ResolveResult>
```

**Resolution Algorithm (executed as a single Neo4j transaction):**

```
Step 1: Look up ALL provided identifiers
────────────────────────────────────────
  UNWIND $identifiers AS ident
  OPTIONAL MATCH (i:Identity {type: ident.type, value: ident.value, _tenant: $tenantId})
                 -[:BELONGS_TO]->(p:Profile)
  RETURN collect(DISTINCT p.profile_id) AS matched_profiles,
         collect(DISTINCT i.identity_id) AS matched_identities

Step 2: Branch based on results
────────────────────────────────
  CASE matched_profiles.length:

    0 profiles found:
      → Create new Profile
      → Create Identity nodes for each identifier
      → Link Identity -[:BELONGS_TO]-> Profile
      → Return { isNew: true }

    1 profile found:
      → Use existing Profile
      → Create any NEW Identity nodes (ones that didn't match)
      → Link new Identities -[:BELONGS_TO]-> existing Profile
      → Enrich Profile with any new data (name, tier, etc.)
      → Return { isNew: false }

    2+ profiles found (MERGE CASE):
      → Pick the oldest Profile as canonical
      → Reparent all events/visits from other Profiles to canonical
      → Move all Identities from other Profiles to canonical
      → Delete the now-empty duplicate Profiles
      → Enrich canonical Profile with best available data
      → Return { merged: true, mergedFromIds: [...] }

Step 3: Set identity strength
─────────────────────────────
  strong:  email (verified), phone (verified), mrn, crm_id, aadhaar
  medium:  device_id, name + city combo
  weak:    cookie_id, session_id, ip_address
```

**Merge Priority (which Profile's data wins):**
```
When merging Profile A and Profile B:
  - name:     prefer the non-null, most recently updated
  - tier:     prefer the highest tier
  - city:     prefer the most recently set
  - ltv:      sum both (they represent the same person's spend)
  - age:      prefer the most recently updated
  - All events/visits/sessions reparented to winner
  - All identities reparented to winner
  - Loser Profile deleted
```

**Cypher for merge operation:**
```cypher
// Reparent all relationships from Profile B to Profile A
MATCH (b:Profile {profile_id: $loserId})-[r]->(n)
MATCH (a:Profile {profile_id: $winnerId})
CREATE (a)-[r2:TYPE(r)]->(n)
SET r2 = properties(r)
DELETE r

// Move identities
MATCH (b:Profile {profile_id: $loserId})<-[r:BELONGS_TO]-(i:Identity)
MATCH (a:Profile {profile_id: $winnerId})
DELETE r
CREATE (i)-[:BELONGS_TO]->(a)

// Delete empty profile
MATCH (b:Profile {profile_id: $loserId})
DELETE b
```

---

## 6. API Design

### 6.1 Auth APIs

#### POST /api/auth/[...nextauth]
NextAuth.js handles Google OAuth + credentials provider. Session includes `userId` and active `orgId`.

#### POST /api/org — Create Organization
```json
// Request
{
  "name": "City Hospital",
  "vertical": "healthcare"
}

// Response (201)
{
  "id": "org_abc123",
  "name": "City Hospital",
  "vertical": "healthcare",
  "tenantId": "tenant_xyz789",
  "plan": "starter",
  "seeded": false
}
```

**Processing:**
1. Create Org record in SQLite (Prisma)
2. Generate unique tenantId
3. Run vertical-specific schema init (indexes + constraints) against Neo4j
4. Optionally seed demo data

#### PUT /api/plan — Change Plan
```json
// Request
{ "plan": "enterprise" }

// Response (200)
{ "plan": "enterprise", "features": { ... } }
```
Updates org.plan in SQLite. No payment — just a flag change.

### 6.2 POST /api/events — Event Ingestion (with Identity Resolution)

Every event goes through identity resolution before any nodes are created.

**Processing pipeline:**
```
Event arrives
    │
    ▼
1. Extract identifiers from payload
   (email, phone, device_id, cookie, user_id, patient_id, mrn...)
    │
    ▼
2. Call resolveIdentity(identifiers, tenantId)
   → Returns profile_id (existing or newly created)
    │
    ▼
3. Create Event/Visit node + linked context nodes
   (Product, Payment, Policy, Diagnosis, Treatment, etc.)
    │
    ▼
4. Link Profile → Event/Visit
    │
    ▼
5. Link to previous event (NEXT chain)
    │
    ▼
6. Return { event_id, profile_id, isNew, merged }
```

**Retail event payload:**
```json
{
  "event_type": "return_initiated",
  "identifiers": {
    "email": "priya@gmail.com",
    "phone": "9876543210",
    "device_id": "dev_xyz"
  },
  "profile_data": {
    "name": "Priya M.",
    "tier": "Gold",
    "city": "Bangalore"
  },
  "properties": { "reason": "size_runs_small", "day_since_purchase": 37 },
  "product": { "product_id": "nike_air_max_001", "name": "Nike Air Max", "category": "Footwear", "brand": "Nike", "price": 8499 },
  "payment": { "method": "COD", "amount": 8499, "status": "refund_pending" },
  "agent": { "agent_id": "agent_ravi_001", "name": "Ravi K.", "action": "approved_exception" },
  "policy": { "policy_id": "return_policy_v3.2", "name": "Return Policy", "version": "v3.2" }
}
```

**Healthcare event payload:**
```json
{
  "event_type": "visit",
  "identifiers": {
    "mrn": "MH-4829",
    "phone": "9123456789",
    "aadhaar": "XXXX4321"
  },
  "profile_data": {
    "name": "Amit Kumar",
    "age": 58,
    "gender": "Male",
    "blood_group": "B+",
    "city": "Mumbai",
    "insurance_provider": "Star Health"
  },
  "visit": {
    "visit_id": "visit_001",
    "type": "Emergency",
    "department": "Cardiology",
    "priority": "Critical",
    "timestamp": "2026-03-15T14:30:00Z"
  },
  "diagnosis": {
    "diagnosis_id": "diag_001",
    "icd_code": "I21.0",
    "name": "Acute MI (STEMI)",
    "severity": "Critical"
  },
  "treatment": {
    "treatment_id": "treat_001",
    "name": "Primary PCI / Angioplasty",
    "type": "Procedure",
    "cost": 250000
  },
  "provider": {
    "provider_id": "dr_sharma_001",
    "name": "Dr. Sharma",
    "specialization": "Cardiologist"
  },
  "medications": [
    { "medication_id": "med_001", "name": "Aspirin", "dosage": "75mg", "frequency": "Once daily" },
    { "medication_id": "med_002", "name": "Clopidogrel", "dosage": "75mg", "frequency": "Once daily" }
  ],
  "insurance_claim": {
    "claim_id": "clm_001",
    "amount": 250000,
    "status": "Pending",
    "payer": "Star Health"
  },
  "protocol": {
    "protocol_id": "proto_stemi_v2.1",
    "name": "Acute MI Protocol",
    "version": "v2.1"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "event_id": "evt_uuid_here",
  "profile_id": "prof_abc123",
  "identity_resolution": {
    "is_new_profile": false,
    "merged": false,
    "identities_matched": ["email", "phone"],
    "identities_added": ["device_id"]
  }
}
```

### 6.3 POST /api/search — Universal Smart Search

**Request:**
```json
{
  "query": "readmissions within 30 days",
  "limit": 50,
  "time_range": { "from": "2026-03-01", "to": "2026-04-09" }
}
```

**Processing:**
1. Get org from session → look up vertical
2. Load vertical-specific Cypher prompt (schema + examples)
3. Inject tenant scope into prompt
4. Send to Groq → get Cypher
5. Validate Cypher (read-only, has LIMIT, has tenant filter)
6. Execute against Neo4j
7. Map results → `{ nodes, edges, timeline }`

**Plan gating:**
- Starter: skip LLM, do basic text-match search against full-text indexes
- Pro/Enterprise: full LLM → Cypher

### 6.4 POST /api/insights — LLM Reasoning Chain

Same as before but vertical-aware. The system prompt changes based on vertical:

**Retail insight prompt:** analyzes purchase patterns, return rates, policy drift, agent behavior
**Healthcare insight prompt:** analyzes readmission causes, protocol adherence, treatment outcomes, claim patterns

**Plan gating:**
- Starter: not available (403)
- Pro: returns `result` only (finding + recommendation)
- Enterprise: returns full `context → reasoning → result` chain

---

## 7. Cypher Generator — Vertical-Aware Prompts

Both prompts use Profile + Identity as the person node. The LLM knows to search by Identity when given an email/phone/ID, and by Profile when given a name or attribute.

### 7.1 Retail Prompt (verticals/retail/prompt.ts)

```
You are a Neo4j Cypher query generator for a RETAIL context graph.

GRAPH SCHEMA:
- (:Profile {profile_id, name, tier, city, ltv, _tenant})         // Unified person
- (:Identity {identity_id, type, value, source, verified, _tenant}) // email, phone, device, cookie
- (:Event {id, event_type, timestamp, status, amount, channel, exception, _tenant})
- (:Product {product_id, name, category, brand, price, _tenant})
- (:Session {session_id, device, os, location, _tenant})
- (:Policy {policy_id, name, version, rule_summary, _tenant})
- (:Agent {agent_id, name, role, team, _tenant})
- (:Payment {payment_id, method, amount, status, _tenant})
- (:Outcome {outcome_id, type, value, description, _tenant})

RELATIONSHIPS:
(Profile)-[:HAS_IDENTITY]->(Identity)
(Profile)-[:PERFORMED]->(Event)-[:NEXT]->(Event)
(Profile)-[:HAS_SESSION]->(Session)-[:CONTAINS]->(Event)
(Event)-[:INVOLVES]->(Product)
(Event)-[:PAID_VIA]->(Payment)
(Event)-[:GOVERNED_BY]->(Policy)
(Event)-[:HANDLED_BY]->(Agent)
(Event)-[:RESULTED_IN]->(Outcome)

IDENTITY RESOLUTION:
- When searching by email/phone/device_id, match via Identity node:
  MATCH (i:Identity {value: $searchValue})-[:BELONGS_TO]->(p:Profile)
- When searching by name/tier/city, match directly on Profile:
  MATCH (p:Profile) WHERE p.name CONTAINS $searchValue

IMPORTANT: Every query MUST include WHERE clause with _tenant = "{tenantId}"
VALID EVENT TYPES: app_install, page_view, product_view, search, add_to_cart,
  remove_from_cart, begin_checkout, add_payment_info, purchase,
  delivery_scheduled, delivery_completed, return_initiated,
  return_completed, refund_issued, support_ticket, review_submitted
VALID TIERS: Bronze, Silver, Gold, Platinum
VALID PAYMENT METHODS: COD, UPI, Credit Card, Debit Card
VALID CATEGORIES: Footwear, Apparel, Accessories

EXAMPLE QUERIES:
- "Priya" →
  MATCH (p:Profile {_tenant: "{tenantId}"}) WHERE p.name CONTAINS "Priya"
  OPTIONAL MATCH (p)-[:PERFORMED]->(e:Event)
  OPTIONAL MATCH (e)-[:INVOLVES]->(prod:Product)
  RETURN p, e, prod ORDER BY e.timestamp ASC LIMIT 50

- "9876543210" →
  MATCH (i:Identity {value: "9876543210", _tenant: "{tenantId}"})
        <-[:HAS_IDENTITY]-(p:Profile)
  OPTIONAL MATCH (p)-[:PERFORMED]->(e:Event)
  RETURN p, i, e ORDER BY e.timestamp ASC LIMIT 50

- "Gold tier returns in Bangalore" →
  MATCH (p:Profile {tier: "Gold", city: "Bangalore", _tenant: "{tenantId}"})
        -[:PERFORMED]->(e:Event {event_type: "return_initiated"})
  OPTIONAL MATCH (e)-[:INVOLVES]->(prod:Product)
  OPTIONAL MATCH (e)-[:PAID_VIA]->(pay:Payment)
  RETURN p, e, prod, pay ORDER BY e.timestamp DESC LIMIT 50
```

### 7.2 Healthcare Prompt (verticals/healthcare/prompt.ts)

```
You are a Neo4j Cypher query generator for a HEALTHCARE context graph.

GRAPH SCHEMA:
- (:Profile {profile_id, name, age, gender, blood_group, city, insurance_provider, _tenant})  // Patient
- (:Identity {identity_id, type, value, source, verified, _tenant})  // mrn, aadhaar, phone, insurance_id
- (:Visit {visit_id, type, timestamp, department, status, priority, duration_hours, _tenant})
- (:Diagnosis {diagnosis_id, icd_code, name, severity, chronic, _tenant})
- (:Treatment {treatment_id, name, type, cost, duration_hours, success, _tenant})
- (:Medication {medication_id, name, dosage, frequency, duration_days, category, _tenant})
- (:Provider {provider_id, name, specialization, department, experience_years, _tenant})
- (:InsuranceClaim {claim_id, amount, status, denial_reason, payer, _tenant})
- (:Protocol {protocol_id, name, version, condition, standard_treatment, _tenant})
- (:Outcome {outcome_id, type, readmission, days_to_readmission, follow_up_scheduled, _tenant})
- (:Department {department_id, name, type, capacity, _tenant})

RELATIONSHIPS:
(Profile)-[:HAS_IDENTITY]->(Identity)
(Profile)-[:HAD_VISIT]->(Visit)-[:NEXT]->(Visit)
(Profile)-[:READMITTED]->(Visit)
(Visit)-[:DIAGNOSED_WITH]->(Diagnosis)
(Visit)-[:TREATED_WITH]->(Treatment)
(Visit)-[:PRESCRIBED]->(Medication)
(Visit)-[:ATTENDED_BY]->(Provider)
(Visit)-[:GOVERNED_BY]->(Protocol)
(Visit)-[:RESULTED_IN]->(Outcome)
(Visit)-[:CLAIMED_VIA]->(InsuranceClaim)
(Visit)-[:IN_DEPARTMENT]->(Department)
(Diagnosis)-[:INDICATES]->(Treatment)
(Treatment)-[:USES]->(Medication)
(Provider)-[:BELONGS_TO]->(Department)

IDENTITY RESOLUTION:
- When searching by MRN/aadhaar/phone/insurance_id, match via Identity:
  MATCH (i:Identity {value: $searchValue})-[:BELONGS_TO]->(p:Profile)
- When searching by patient name/age/city, match on Profile:
  MATCH (p:Profile) WHERE p.name CONTAINS $searchValue

IMPORTANT: Every query MUST include WHERE clause with _tenant = "{tenantId}"
VALID VISIT TYPES: Emergency, Outpatient, Inpatient, Follow-up, Surgery
VALID PRIORITIES: Critical, High, Medium, Low
VALID SEVERITIES: Critical, Severe, Moderate, Mild
VALID CLAIM STATUSES: Approved, Denied, Pending, Partial
VALID DEPARTMENTS: Cardiology, Orthopedics, General Medicine, Emergency, Neurology, Pulmonology

EXAMPLE QUERIES:
- "readmissions within 30 days" →
  MATCH (p:Profile {_tenant: "{tenantId}"})-[:HAD_VISIT]->(v:Visit)
        -[:RESULTED_IN]->(o:Outcome)
  WHERE o.readmission = true AND o.days_to_readmission <= 30
  OPTIONAL MATCH (v)-[:DIAGNOSED_WITH]->(d:Diagnosis)
  OPTIONAL MATCH (v)-[:ATTENDED_BY]->(pr:Provider)
  RETURN p, v, o, d, pr ORDER BY o.days_to_readmission ASC LIMIT 50

- "Dr. Sharma cardiac patients" →
  MATCH (pr:Provider {name: "Dr. Sharma", _tenant: "{tenantId}"})
        <-[:ATTENDED_BY]-(v:Visit)<-[:HAD_VISIT]-(p:Profile)
  WHERE v.department = "Cardiology"
  OPTIONAL MATCH (v)-[:DIAGNOSED_WITH]->(d:Diagnosis)
  OPTIONAL MATCH (v)-[:TREATED_WITH]->(t:Treatment)
  RETURN p, v, pr, d, t ORDER BY v.timestamp DESC LIMIT 50

- "insurance denials for knee replacement" →
  MATCH (ic:InsuranceClaim {status: "Denied", _tenant: "{tenantId}"})
        <-[:CLAIMED_VIA]-(v:Visit)-[:TREATED_WITH]->(t:Treatment)
  WHERE t.name CONTAINS "Knee" OR t.name CONTAINS "knee"
  OPTIONAL MATCH (v)<-[:HAD_VISIT]-(p:Profile)
  RETURN p, v, t, ic ORDER BY ic.amount DESC LIMIT 50

- "MH-4829" (MRN lookup) →
  MATCH (i:Identity {value: "MH-4829", _tenant: "{tenantId}"})
        <-[:HAS_IDENTITY]-(p:Profile)
  OPTIONAL MATCH (p)-[:HAD_VISIT]->(v:Visit)
  OPTIONAL MATCH (v)-[:DIAGNOSED_WITH]->(d:Diagnosis)
  RETURN p, i, v, d ORDER BY v.timestamp ASC LIMIT 50

[more examples...]
```

---

## 8. Kafka Event Streaming Pipeline

### 8.1 Upstash Kafka Setup

Upstash Kafka is serverless — no brokers to manage, REST API for produce/consume, free tier (10K messages/day).

**Environment variables:**
```bash
UPSTASH_KAFKA_REST_URL=https://xxx.upstash.io
UPSTASH_KAFKA_REST_USERNAME=xxx
UPSTASH_KAFKA_REST_PASSWORD=xxx
```

**Topics (created per tenant on onboarding):**
```
events-{tenantId}        # All raw events for this tenant
events-{tenantId}-dlq    # Dead letter queue for failed processing
```

### 8.2 Kafka Producer (lib/kafka.ts)

```typescript
import { Kafka } from '@upstash/kafka';

const kafka = new Kafka({
  url: process.env.UPSTASH_KAFKA_REST_URL!,
  username: process.env.UPSTASH_KAFKA_REST_USERNAME!,
  password: process.env.UPSTASH_KAFKA_REST_PASSWORD!,
});

const producer = kafka.producer();

export async function produceEvent(tenantId: string, event: ValidatedEvent): Promise<void> {
  await producer.produce(`events-${tenantId}`, JSON.stringify({
    ...event,
    _tenant: tenantId,
    _produced_at: new Date().toISOString(),
  }));
}

export async function produceBatch(tenantId: string, events: ValidatedEvent[]): Promise<void> {
  const messages = events.map(e => ({
    topic: `events-${tenantId}`,
    value: JSON.stringify({ ...e, _tenant: tenantId, _produced_at: new Date().toISOString() }),
  }));
  await producer.produceMany(messages);
}
```

### 8.3 Kafka Consumer (lib/event-processor.ts)

The consumer runs as a Next.js API route that is called on a schedule (cron) or via a webhook trigger.

```typescript
import { Kafka } from '@upstash/kafka';

const consumer = kafka.consumer();

export async function processEvents(tenantId: string): Promise<ProcessResult> {
  const messages = await consumer.consume({
    consumerGroupId: `contextmesh-${tenantId}`,
    instanceId: `processor-${tenantId}`,
    topics: [`events-${tenantId}`],
    autoOffsetReset: 'earliest',
  });

  let processed = 0;
  let failed = 0;

  for (const msg of messages) {
    try {
      const event = JSON.parse(msg.value);

      // 1. Identity resolution
      const { profileId } = await resolveIdentity(
        event.identifiers, tenantId, event.profile_data
      );

      // 2. Create event + context nodes in Neo4j
      await createEventGraph(profileId, event, tenantId);

      // 3. Extract commitments (if any)
      await extractCommitments(profileId, event, tenantId);

      // 4. Update embeddings (if Pro/Enterprise)
      if (orgPlan !== 'starter') {
        await updateJourneyEmbedding(profileId, tenantId);
      }

      processed++;
    } catch (error) {
      // Send to dead letter queue
      await producer.produce(`events-${tenantId}-dlq`, msg.value);
      failed++;
    }
  }

  return { processed, failed };
}
```

### 8.4 API Route Changes

**POST /api/events — now produces to Kafka instead of direct graph write:**
```typescript
export async function POST(req: NextRequest) {
  // 1. Auth + get tenantId
  // 2. Zod validate
  // 3. Produce to Kafka
  await produceEvent(tenantId, validatedEvent);

  // 4. Return immediately (async processing)
  return NextResponse.json(
    { accepted: true, message: "Event queued for processing" },
    { status: 202 }
  );
}
```

**POST /api/events/batch — same pattern:**
```typescript
export async function POST(req: NextRequest) {
  // 1. Auth + get tenantId
  // 2. Zod validate all events
  // 3. Produce batch to Kafka
  await produceBatch(tenantId, validatedEvents);

  return NextResponse.json(
    { accepted: true, queued: validatedEvents.length },
    { status: 202 }
  );
}
```

**POST /api/events/process — consumer trigger (called by cron or webhook):**
```typescript
export async function POST(req: NextRequest) {
  const { tenantId } = await req.json();
  const result = await processEvents(tenantId);
  return NextResponse.json(result);
}
```

### 8.5 Consumer Processing Pipeline

```
Kafka Message
    │
    ▼
1. Deserialize + validate
    │
    ▼
2. Identity Resolution
   (resolveIdentity → Profile + Identity nodes)
    │
    ▼
3. Create Event/Visit node + context nodes
   (Product, Payment, Policy, Treatment, etc.)
    │
    ▼
4. Link Profile → Event, Event → NEXT chain
    │
    ▼
5. Extract Commitments (if promise language detected)
    │
    ▼
6. Update journey embedding (Pro/Enterprise only)
    │
    ▼
7. Ack message (consumer offset advanced)

On failure at any step:
  → Send original message to DLQ
  → Log error with event ID
  → Continue processing next message
```

### 8.6 Transcript Extraction (lib/transcript-extractor.ts)

Converts raw STT transcript into structured events.

**POST /api/events/transcript**

```typescript
export async function POST(req: NextRequest) {
  // 1. Auth + get tenantId + get vertical
  const { tenantId, vertical } = await getOrgFromSession(req);

  // 2. Validate transcript format
  const body = await req.json();
  const { transcript, participants, call_id, timestamp, duration_seconds } = body;

  // 3. Build extraction prompt (vertical-aware)
  const extractionPrompt = buildTranscriptPrompt(vertical, transcript, participants);

  // 4. Send to Groq for structured extraction
  const extracted = await groqExtract(extractionPrompt);
  // Returns: { identifiers, profile_data, events[], commitments[], sentiment }

  // 5. Produce extracted events to Kafka (same pipeline)
  for (const event of extracted.events) {
    await produceEvent(tenantId, {
      ...event,
      identifiers: extracted.identifiers,
      profile_data: extracted.profile_data,
      source: 'voice_stt',
      call_id,
    });
  }

  // 6. Produce commitments as separate events
  for (const commitment of extracted.commitments) {
    await produceEvent(tenantId, {
      event_type: 'commitment_made',
      identifiers: extracted.identifiers,
      properties: commitment,
      source: 'voice_stt',
      call_id,
    });
  }

  return NextResponse.json({
    accepted: true,
    call_id,
    events_extracted: extracted.events.length,
    commitments_extracted: extracted.commitments.length,
    sentiment: extracted.sentiment,
  }, { status: 202 });
}
```

**Extraction Prompt (retail):**
```
You are analyzing a customer support call transcript for a retail company.

Extract ALL of the following from the conversation:

1. IDENTIFIERS: phone, email, name, order_id — anything that identifies the customer
2. PROFILE DATA: tier/membership level, city if mentioned
3. EVENTS: every action or decision (support_call, return_initiated, complaint, etc.)
   For each event include: event_type, properties, product details, payment info, policy applied, agent action
4. DECISIONS: any policy exceptions, escalations, overrides — include reasoning
5. COMMITMENTS: any promises made ("refund within 48h", "callback tomorrow")
   Include: promise_text, deadline (ISO date), assignee
6. SENTIMENT: overall trajectory (e.g. "frustrated → resolved"), score 0-1

Return as JSON. If something isn't mentioned, omit it.

TRANSCRIPT:
{transcript_text}
```

**Extraction Prompt (healthcare):**
```
You are analyzing a clinical transcript (doctor dictation / patient call).

Extract ALL of the following:

1. IDENTIFIERS: MRN, phone, name, aadhaar — anything identifying the patient
2. PROFILE DATA: age, gender, blood group, city, insurance provider
3. EVENTS: every clinical event (visit, diagnosis, treatment, medication, discharge)
   For each: event_type, details, severity, department, provider
4. DECISIONS: any protocol deviations, treatment choices, referrals — include reasoning
5. COMMITMENTS: follow-up appointments, medication instructions, referrals
   Include: promise_text, deadline, assignee (doctor/department)
6. PROTOCOL REFERENCES: any clinical protocols mentioned or implied

Return as JSON.

TRANSCRIPT:
{transcript_text}
```

**After extraction, events flow into the same Kafka → Consumer → Identity Resolution → Graph Write pipeline. No special handling needed.**

---

## 9. Commitment Tracker

### 9.1 Commitment Node Schema

```cypher
(:Commitment {
  commitment_id:  String    UNIQUE,
  promise_text:   String,          // "Refund within 48 hours"
  deadline:       DateTime,
  status:         String,          // "open" | "fulfilled" | "breached" | "cancelled"
  assignee:       String,          // Agent/Provider name
  created_at:     DateTime,
  fulfilled_at:   DateTime,        // null until fulfilled
  breached_at:    DateTime,        // null until breached
  _tenant:        String
})

// Relationships
(Profile)-[:HAS_COMMITMENT]->(Commitment)
(Commitment)-[:MADE_BY]->(Agent) or (Commitment)-[:MADE_BY]->(Provider)
(Commitment)-[:FROM_EVENT]->(Event) or (Commitment)-[:FROM_VISIT]->(Visit)
```

### 9.2 Extraction (lib/commitment-tracker.ts)

```typescript
interface Commitment {
  promise_text: string;
  deadline: string | null;        // ISO date, or null if no specific deadline
  assignee: string | null;
}

async function extractCommitments(
  profileId: string, event: ProcessedEvent, tenantId: string
): Promise<Commitment[]> {
  // Check event properties for commitment indicators
  const commitmentFields = [
    event.properties?.promise,
    event.properties?.commitment,
    event.properties?.follow_up,
    event.properties?.deadline,
  ].filter(Boolean);

  if (commitmentFields.length === 0) return [];

  // For unstructured text, use LLM to extract
  const prompt = `Extract any promises or commitments from this event:
    Event type: ${event.event_type}
    Properties: ${JSON.stringify(event.properties)}
    Return JSON array: [{ "promise_text": "...", "deadline": "ISO date or null", "assignee": "name or null" }]
    Return empty array [] if no commitments found.`;

  const commitments = await groqExtract(prompt);

  // Write to graph
  for (const c of commitments) {
    await runQuery(`
      MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
      CREATE (c:Commitment {
        commitment_id: $commitmentId,
        promise_text: $promiseText,
        deadline: CASE WHEN $deadline IS NOT NULL THEN datetime($deadline) ELSE null END,
        status: "open",
        assignee: $assignee,
        created_at: datetime(),
        _tenant: $tenantId
      })
      CREATE (p)-[:HAS_COMMITMENT]->(c)
    `, { profileId, tenantId, commitmentId: uuid(), ...c });
  }

  return commitments;
}
```

### 9.3 Breach Detection

Runs as part of the alert engine (daily or on-demand):

```cypher
// Find breached commitments (deadline passed, still open)
MATCH (c:Commitment {status: "open", _tenant: $tenantId})
WHERE c.deadline IS NOT NULL AND c.deadline < datetime()
SET c.status = "breached", c.breached_at = datetime()
RETURN c
```

### 9.4 API: GET /api/profiles/[id] — includes commitments

```json
{
  "profile": { "name": "Priya M.", "tier": "Gold" },
  "identities": [...],
  "events": [...],
  "commitments": [
    { "promise_text": "Refund within 48h", "deadline": "2026-04-07", "status": "breached" },
    { "promise_text": "Brand escalation by EOD", "deadline": "2026-04-09", "status": "open" }
  ]
}
```

---

## 10. Proactive Alert Engine

### 10.1 Alert Types

```typescript
interface Alert {
  alert_id: string;
  type: 'policy_drift' | 'risk_signal' | 'anomaly_spike';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  data: Record<string, unknown>;
  tenant_id: string;
  created_at: string;
  acknowledged: boolean;
}
```

### 10.2 Policy Drift Detection

```cypher
// Find policies being overridden beyond threshold
MATCH (e:Event {_tenant: $tenantId})-[:GOVERNED_BY]->(pol:Policy)
WHERE e.timestamp >= datetime() - duration("P90D")
WITH pol, count(e) AS total_applications,
     count(CASE WHEN e.exception = true THEN 1 END) AS exception_count
WHERE total_applications >= 10
WITH pol, total_applications, exception_count,
     toFloat(exception_count) / total_applications AS override_rate
WHERE override_rate > $threshold  // default 0.3
RETURN pol.name AS policy, pol.version AS version,
       override_rate, total_applications, exception_count
ORDER BY override_rate DESC
```

### 10.3 Risk Scoring (Churn / Readmission)

**Retail (churn risk):**
```cypher
MATCH (p:Profile {_tenant: $tenantId})-[:PERFORMED]->(e:Event)
WHERE e.timestamp >= datetime() - duration("P90D")
WITH p,
     count(CASE WHEN e.event_type = 'support_ticket' THEN 1 END) AS escalations,
     count(CASE WHEN e.event_type = 'return_initiated' THEN 1 END) AS returns,
     count(CASE WHEN e.event_type = 'purchase' THEN 1 END) AS purchases
OPTIONAL MATCH (p)-[:HAS_COMMITMENT]->(c:Commitment {status: "breached"})
WITH p, escalations, returns, purchases, count(c) AS breached_commitments
WITH p,
     CASE WHEN purchases = 0 THEN 0.5 ELSE toFloat(returns) / purchases END AS return_rate,
     escalations * 0.2 AS escalation_score,
     breached_commitments * 0.15 AS breach_score
WITH p, return_rate + escalation_score + breach_score AS risk_score
WHERE risk_score > $threshold  // default 0.7
RETURN p.profile_id, p.name, round(risk_score, 2) AS risk_score
ORDER BY risk_score DESC
```

**Healthcare (readmission risk):**
```cypher
MATCH (p:Profile {_tenant: $tenantId})-[:HAD_VISIT]->(v:Visit)-[:RESULTED_IN]->(o:Outcome)
WHERE o.readmission = true
WITH p, count(o) AS readmission_count
OPTIONAL MATCH (p)-[:HAS_COMMITMENT]->(c:Commitment {status: "breached"})
WITH p, readmission_count, count(c) AS missed_followups
WITH p, readmission_count * 0.4 + missed_followups * 0.3 AS risk_score
WHERE risk_score > $threshold
RETURN p.profile_id, p.name, round(risk_score, 2) AS risk_score
ORDER BY risk_score DESC
```

### 10.4 Anomaly Spike Detection

```cypher
// Compare this week's event counts to 30-day average
MATCH (e:Event {_tenant: $tenantId})
WHERE e.timestamp >= datetime() - duration("P7D")
WITH e.event_type AS event_type, count(*) AS this_week
MATCH (e2:Event {_tenant: $tenantId})
WHERE e2.timestamp >= datetime() - duration("P30D")
  AND e2.timestamp < datetime() - duration("P7D")
WITH event_type, this_week,
     count(e2) AS last_23_days,
     toFloat(count(e2)) / 3.29 AS weekly_avg  // 23 days / 7
WHERE this_week > weekly_avg * $spikeMultiplier  // default 2.0
RETURN event_type, this_week, round(weekly_avg, 0) AS avg_weekly,
       round(toFloat(this_week) / weekly_avg, 1) AS multiplier
ORDER BY multiplier DESC
```

### 10.5 API: GET /api/alerts

```json
{
  "alerts": [
    {
      "alert_id": "alert_001",
      "type": "policy_drift",
      "severity": "warning",
      "title": "Return Policy v3.2: 72% override rate",
      "description": "Gold tier customers receive exceptions 72% of the time (threshold: 30%). Consider formalizing.",
      "data": { "policy": "Return Policy v3.2", "override_rate": 0.72, "total": 47 }
    },
    {
      "alert_id": "alert_002",
      "type": "anomaly_spike",
      "severity": "critical",
      "title": "Nike Footwear returns spiked 3.2x this week",
      "description": "41 returns this week vs 13 weekly average. Top reason: size_runs_small (67%)",
      "data": { "event_type": "return_initiated", "this_week": 41, "avg": 13, "multiplier": 3.2 }
    }
  ]
}
```

---

## 11. Value Dashboard (Stats API)

### GET /api/stats

Computes live metrics from the graph for the value dashboard.

```typescript
async function getStats(tenantId: string): Promise<DashboardStats> {
  const [events, profiles, patterns, commitments, alerts] = await Promise.all([
    // Total events
    runQuery(`MATCH (e:Event {_tenant: $t}) RETURN count(e) AS c UNION ALL
              MATCH (v:Visit {_tenant: $t}) RETURN count(v) AS c`, { t: tenantId }),
    // Total profiles + identity fragments
    runQuery(`MATCH (p:Profile {_tenant: $t}) RETURN count(p) AS profiles
              MATCH (i:Identity {_tenant: $t}) RETURN count(i) AS identities`, { t: tenantId }),
    // Patterns discovered (from last community detection run, cached)
    getCachedPatterns(tenantId),
    // Commitment stats
    runQuery(`MATCH (c:Commitment {_tenant: $t})
              RETURN c.status AS status, count(c) AS count`, { t: tenantId }),
    // Active alerts
    runQuery(`MATCH (a:Alert {_tenant: $t, acknowledged: false})
              RETURN count(a) AS count`, { t: tenantId }),
  ]);

  return { events, profiles, patterns, commitments, alerts };
}
```

**Response:**
```json
{
  "events_tracked": 2847,
  "profiles_resolved": 50,
  "identity_fragments_merged": 127,
  "patterns_discovered": 3,
  "insights_generated": 12,
  "commitments": { "open": 34, "fulfilled": 28, "breached": 6 },
  "alerts_active": 4,
  "policy_drift_detected": 1,
  "kafka_messages_processed": 2847,
  "kafka_messages_failed": 3
}
```

---

## 12. Agent Context API — Side A

### 12.1 GET /api/agent/context — Pre-Conversation Brief

Assembles everything an agent (AI or human) needs in a single call.

**Request:**
```
GET /api/agent/context?phone=9876543210
GET /api/agent/context?email=priya@gmail.com
GET /api/agent/context?mrn=MH-4829
GET /api/agent/context?profile_id=prof_abc123
```

Any identifier works — identity resolution finds the Profile.

**Implementation:**

```typescript
// app/api/agent/context/route.ts

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromSession(req);
  const vertical = await getVerticalFromSession(req);
  const identifier = req.nextUrl.searchParams;

  // 1. Resolve identity → Profile
  const profileId = await resolveFromAnyIdentifier(identifier, tenantId);
  if (!profileId) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // 2. Run all queries in parallel
  const [profile, recentEvents, commitments, exceptions, riskScore] = await Promise.all([
    getProfile(profileId, tenantId),
    getRecentEvents(profileId, tenantId, 10),    // last 10, relevance-scored
    getOpenCommitments(profileId, tenantId),
    getActiveExceptions(profileId, tenantId),
    computeRiskScore(profileId, tenantId, vertical),
  ]);

  // 3. Vector similarity — find similar cases
  const similarCases = await findSimilarProfiles(profileId, tenantId, 3);

  // 4. Assemble risk signals
  const riskSignals = buildRiskSignals(recentEvents, commitments, riskScore);

  // 5. LLM generates suggested actions (Groq, <500ms)
  const suggestedActions = await generateSuggestedActions({
    profile, recentEvents, commitments, exceptions, riskSignals, vertical
  });

  return NextResponse.json({
    profile,
    recent_events: recentEvents,
    open_commitments: commitments,
    active_exceptions: exceptions,
    similar_cases: similarCases,
    risk_score: riskScore,
    risk_signals: riskSignals,
    suggested_actions: suggestedActions,
  });
}
```

**Suggested Actions Prompt:**
```
You are an agent copilot. Given this customer context, suggest 2-3
specific actions for the agent handling the next interaction.

Rules:
- Be specific to THIS customer, not generic advice
- Reference actual data (breached commitment, recent return, risk score)
- If there's a breached commitment, the first action should address it
- If risk score > 0.7, suggest retention-focused actions
- Keep each action to 1 sentence

Context:
{serialized profile + events + commitments + risk signals}
```

**Cypher for recent events (relevance-scored):**
```cypher
MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
      -[:PERFORMED|HAD_VISIT]->(e)
OPTIONAL MATCH (e)-[:INVOLVES|DIAGNOSED_WITH]->(detail)
OPTIONAL MATCH (e)-[:GOVERNED_BY]->(pol)
OPTIONAL MATCH (e)-[:RESULTED_IN]->(o)
WITH e, detail, pol, o,
     duration.inDays(e.timestamp, datetime()).days AS age_days
WITH e, detail, pol, o, age_days,
     round(0.9 * exp(-0.01 * age_days) *
       CASE WHEN pol IS NOT NULL AND pol.version = $currentVersion THEN 1.0 ELSE 0.5 END *
       CASE WHEN o IS NOT NULL AND o.type IN ['Recovered','customer_retained'] THEN 1.0 ELSE 0.7 END
     , 2) AS relevance
RETURN e, detail, pol, o, relevance
ORDER BY relevance DESC
LIMIT $limit
```

**Performance:** <100ms with Redis cache, <300ms without. Cache key = `agent-context:{profileId}`, TTL = 15 min, invalidated on new event for this profile.

### 12.2 POST /api/mcp — MCP Server

Exposes the context graph via Model Context Protocol so any AI agent framework can query it.

```typescript
// app/api/mcp/route.ts

export async function POST(req: NextRequest) {
  const { method, params } = await req.json();
  const tenantId = await getTenantFromApiKey(req); // API key auth for MCP

  switch (method) {
    case 'resources/list':
      return NextResponse.json({
        resources: [
          { uri: 'contextmesh://profiles', name: 'Customer/Patient Profiles' },
          { uri: 'contextmesh://events', name: 'Events & Visits' },
          { uri: 'contextmesh://commitments', name: 'Open Commitments' },
          { uri: 'contextmesh://alerts', name: 'Active Alerts' },
        ]
      });

    case 'resources/read':
      // Route to existing APIs based on URI
      if (params.uri.startsWith('contextmesh://profiles/'))
        return getProfile(params.uri.split('/').pop(), tenantId);
      // ...

    case 'tools/call':
      // Expose search, insights, patterns as MCP tools
      if (params.name === 'search')
        return handleSearch(params.arguments.query, tenantId);
      if (params.name === 'get_context')
        return handleAgentContext(params.arguments.identifier, tenantId);
      if (params.name === 'analyze')
        return handleInsight(params.arguments, tenantId);
  }
}
```

---

## 13. Client Intelligence Dashboard — Side B

### 13.1 Dashboard Pages

```
/dashboard                → Search + Graph + Timeline (existing)
/dashboard/analytics      → Decision volume, exception rates, source breakdown
/dashboard/policies       → Policy drift analysis
/dashboard/agents         → Agent/Provider performance comparison
/dashboard/commitments    → Commitment fulfillment tracking
```

### 13.2 Analytics Page (/dashboard/analytics)

**Queries:**

```cypher
// Decision volume by type (last 30 days)
MATCH (e:Event {_tenant: $tenantId})
WHERE e.timestamp >= datetime() - duration("P30D")
RETURN e.event_type AS type, count(e) AS count
ORDER BY count DESC

// Exception rate trend (weekly for last 12 weeks)
MATCH (e:Event {_tenant: $tenantId})
WHERE e.timestamp >= datetime() - duration("P84D")
WITH e, duration.inDays(datetime() - duration("P84D"), e.timestamp).days / 7 AS week
RETURN week, count(e) AS total,
       count(CASE WHEN e.exception = true THEN 1 END) AS exceptions,
       round(toFloat(count(CASE WHEN e.exception = true THEN 1 END)) / count(e), 2) AS rate
ORDER BY week

// Source breakdown
MATCH (e:Event {_tenant: $tenantId})
WHERE e.timestamp >= datetime() - duration("P30D")
RETURN e.channel AS source, count(e) AS count
ORDER BY count DESC
```

**Rendered as:** Line chart (volume trend), area chart (exception rate), pie chart (sources), bar chart (top products/diagnoses).

### 13.3 Policy Drift Page (/dashboard/policies)

```cypher
// All policies with override rates
MATCH (e:Event {_tenant: $tenantId})-[:GOVERNED_BY]->(pol:Policy)
WHERE e.timestamp >= datetime() - duration("P90D")
WITH pol, count(e) AS total,
     count(CASE WHEN e.exception = true THEN 1 END) AS overrides
RETURN pol.name AS policy, pol.version AS version,
       total, overrides,
       round(toFloat(overrides) / total, 2) AS override_rate,
       CASE WHEN toFloat(overrides)/total > 0.3 THEN "drift" ELSE "ok" END AS status
ORDER BY override_rate DESC
```

**Rendered as:** Table with red highlight for drift > 30%. Click row → navigates to `/dashboard?query=Policy+v3.2+exceptions`.

### 13.4 Agent Performance Page (/dashboard/agents)

```cypher
// Agent comparison (retail)
MATCH (a:Agent {_tenant: $tenantId})<-[:HANDLED_BY]-(e:Event)
WHERE e.timestamp >= datetime() - duration("P90D")
OPTIONAL MATCH (e)-[:RESULTED_IN]->(o:Outcome)
WITH a, count(e) AS handled,
     count(CASE WHEN e.exception = true THEN 1 END) AS exceptions,
     count(CASE WHEN o.type = 'customer_retained' THEN 1 END) AS retained
RETURN a.name AS agent, a.role AS role, handled,
       round(toFloat(exceptions) / handled, 2) AS exception_rate,
       round(toFloat(retained) / handled, 2) AS retention_rate
ORDER BY handled DESC

// Provider comparison (healthcare)
MATCH (pr:Provider {_tenant: $tenantId})<-[:ATTENDED_BY]-(v:Visit)
WHERE v.timestamp >= datetime() - duration("P90D")
OPTIONAL MATCH (v)-[:RESULTED_IN]->(o:Outcome)
WITH pr, count(v) AS visits,
     count(CASE WHEN o.readmission = true THEN 1 END) AS readmissions,
     count(CASE WHEN o.type = 'Recovered' THEN 1 END) AS recovered
RETURN pr.name AS provider, pr.specialization AS specialty, visits,
       round(toFloat(readmissions) / visits, 2) AS readmission_rate,
       round(toFloat(recovered) / visits, 2) AS recovery_rate
ORDER BY visits DESC
```

**Rendered as:** Sortable table + bar chart comparison. Click agent → navigates to `/dashboard?query=Agent+Ravi`.

### 13.5 Commitment Page (/dashboard/commitments)

```cypher
// Active commitments with countdown
MATCH (c:Commitment {_tenant: $tenantId})
WHERE c.status IN ['open', 'breached']
OPTIONAL MATCH (p:Profile)-[:HAS_COMMITMENT]->(c)
OPTIONAL MATCH (c)-[:MADE_BY]->(a)
RETURN c.promise_text AS promise, c.deadline AS deadline, c.status AS status,
       p.name AS customer, a.name AS assignee,
       CASE WHEN c.deadline < datetime() THEN 'overdue'
            WHEN c.deadline < datetime() + duration("P1D") THEN 'due_soon'
            ELSE 'on_track' END AS urgency
ORDER BY CASE c.status WHEN 'breached' THEN 0 ELSE 1 END, c.deadline ASC

// Fulfillment rate by agent
MATCH (c:Commitment {_tenant: $tenantId})-[:MADE_BY]->(a)
WITH a.name AS agent, count(c) AS total,
     count(CASE WHEN c.status = 'fulfilled' THEN 1 END) AS fulfilled
RETURN agent, total, fulfilled,
       round(toFloat(fulfilled) / total, 2) AS fulfillment_rate
ORDER BY fulfillment_rate ASC
```

**Rendered as:** List with urgency badges (red=breached, yellow=due soon, green=on track) + bar chart of fulfillment rate by agent.

---

## 14. Vector Similarity Search

### 8.1 Vector Index Setup

Neo4j 5.11+ supports native vector indexes. Each Profile gets a journey embedding vector.

**Index creation:**
```cypher
// Create vector index on Profile nodes
CREATE VECTOR INDEX profile_journey_embedding IF NOT EXISTS
FOR (p:Profile)
ON (p.journey_embedding)
OPTIONS {indexConfig: {
  `vector.dimensions`: 1024,
  `vector.similarity_function`: 'cosine'
}}
```

### 8.2 Embedding Generation

When a Profile's events change (new event ingested), regenerate the embedding:

```typescript
// lib/embeddings.ts
async function generateJourneyEmbedding(profileId: string, tenantId: string): Promise<number[]> {
  // 1. Fetch the profile's event summary
  const events = await runQuery(`
    MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
          -[:PERFORMED|HAD_VISIT]->(e)
    OPTIONAL MATCH (e)-[:INVOLVES|DIAGNOSED_WITH]->(detail)
    RETURN e, detail ORDER BY e.timestamp ASC
  `, { profileId, tenantId });

  // 2. Serialize journey to text
  const journeyText = serializeJourney(events);
  // e.g. "Gold tier user in Bangalore. Browsed 12 products. Added Nike Air Max to cart.
  //        Purchased via COD. Returned on Day 37, size issue, policy exception granted."

  // 3. Generate embedding via Groq (or sentence-transformer)
  const embedding = await groq.embeddings.create({
    model: 'llama-3.3-70b-versatile',  // or a dedicated embedding model
    input: journeyText,
  });

  // 4. Store on Profile node
  await runQuery(`
    MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
    SET p.journey_embedding = $embedding
  `, { profileId, tenantId, embedding: embedding.data[0].embedding });

  return embedding.data[0].embedding;
}
```

### 8.3 POST /api/search/similar — Similarity Search API

**Request:**
```json
{
  "node_id": "prof_abc123",
  "node_label": "Profile",
  "limit": 5
}
```

**Cypher executed:**
```cypher
// Get the source node's embedding
MATCH (source:Profile {profile_id: $nodeId, _tenant: $tenantId})
WITH source, source.journey_embedding AS embedding

// Vector similarity search
CALL db.index.vector.queryNodes('profile_journey_embedding', $limit, embedding)
YIELD node AS similar, score
WHERE similar.profile_id <> source.profile_id
  AND similar._tenant = $tenantId

// Fetch connected context for comparison
OPTIONAL MATCH (similar)-[:PERFORMED|HAD_VISIT]->(e)
OPTIONAL MATCH (e)-[:INVOLVES|DIAGNOSED_WITH]->(detail)

RETURN similar, score, collect(e) AS events, collect(detail) AS details
ORDER BY score DESC
LIMIT $limit
```

**Response (200):**
```json
{
  "source": { "profile_id": "prof_abc123", "name": "Amit Kumar" },
  "similar": [
    {
      "profile": { "profile_id": "prof_def456", "name": "Suresh R." },
      "score": 0.94,
      "shared_factors": ["Same diagnosis (STEMI)", "Same stent type", "Both readmitted < 30 days"]
    },
    {
      "profile": { "profile_id": "prof_ghi789", "name": "Kavita P." },
      "score": 0.81,
      "shared_factors": ["Same missed follow-up", "Same department", "Both protocol v2.1"]
    }
  ]
}
```

---

## 15. Graph Algorithms — Pattern Discovery

### 9.1 Community Detection (Louvain)

Runs on the event/visit subgraph to find clusters of related traces.

**POST /api/patterns/discover**

**Request:**
```json
{
  "algorithm": "community",
  "min_cluster_size": 3
}
```

**Cypher (Retail):**
```cypher
// Project a similarity graph based on shared connections
MATCH (e1:Event {_tenant: $tenantId})-[:INVOLVES]->(shared)<-[:INVOLVES]-(e2:Event {_tenant: $tenantId})
WHERE e1.id < e2.id
WITH e1, e2, count(shared) AS shared_count
WHERE shared_count >= 1

// Run Louvain community detection via GDS
CALL gds.graph.project('tenant_graph_' + $tenantId,
  'Event', 'SIMILAR_TO',
  { relationshipProperties: ['weight'] }
)
CALL gds.louvain.stream('tenant_graph_' + $tenantId)
YIELD nodeId, communityId
WITH communityId, collect(gds.util.asNode(nodeId)) AS members
WHERE size(members) >= $minClusterSize

// Enrich each cluster with connected context
UNWIND members AS m
OPTIONAL MATCH (p:Profile)-[:PERFORMED]->(m)
OPTIONAL MATCH (m)-[:INVOLVES]->(prod:Product)
OPTIONAL MATCH (m)-[:GOVERNED_BY]->(pol:Policy)

RETURN communityId,
       size(members) AS cluster_size,
       collect(DISTINCT m.event_type) AS event_types,
       collect(DISTINCT prod.name) AS products,
       collect(DISTINCT pol.name) AS policies,
       collect(DISTINCT p.name) AS users
ORDER BY cluster_size DESC
LIMIT 10
```

**Cypher (Healthcare — same pattern, different nodes):**
```cypher
MATCH (v1:Visit {_tenant: $tenantId})-[:DIAGNOSED_WITH]->(shared:Diagnosis)
      <-[:DIAGNOSED_WITH]-(v2:Visit {_tenant: $tenantId})
WHERE v1.visit_id < v2.visit_id
// ... same Louvain community detection ...
// Enrich with Provider, Protocol, Outcome
```

**Processing pipeline:**
1. Run community detection → get raw clusters
2. For each cluster, gather the connected context (products, policies, providers, etc.)
3. Send cluster summaries to Groq → LLM generates human-readable pattern description
4. Return clusters with AI-generated summaries

**Response (200):**
```json
{
  "patterns": [
    {
      "cluster_id": 1,
      "cluster_size": 8,
      "summary": "Nike Sizing Returns — 8 Gold/Platinum tier users returned Nike footwear citing size issues. Agent Ravi handled 6 of 8, all received policy exceptions.",
      "common_factors": {
        "products": ["Nike Air Max", "Nike Ultraboost"],
        "event_types": ["return_initiated", "refund_issued"],
        "policies": ["Return Policy v3.2"],
        "agents": ["Ravi K."]
      },
      "recommendation": "Add size guide to Nike footwear pages. Consider formalizing Gold tier exception."
    }
  ]
}
```

### 9.2 PageRank — Influential Nodes

Find the most influential nodes in the graph (most-connected policies, products, providers).

```cypher
CALL gds.pageRank.stream('tenant_graph_' + $tenantId)
YIELD nodeId, score
WITH gds.util.asNode(nodeId) AS node, score
RETURN labels(node)[0] AS type, node.name AS name, score
ORDER BY score DESC
LIMIT 20
```

Returned as a "Top Influencers" panel in the dashboard.

### 9.3 Shortest Path — Connection Discovery

When a user asks "how are these two things connected?":

```cypher
MATCH path = shortestPath(
  (a {_tenant: $tenantId})-[*..5]-(b {_tenant: $tenantId})
)
WHERE a.profile_id = $nodeA OR a.id = $nodeA
  AND b.profile_id = $nodeB OR b.id = $nodeB
RETURN path
```

---

## 16. Relevance Scoring

### 10.1 Score Computation

Relevance is computed at query time, not stored (always fresh):

```cypher
// Add relevance score to every event/visit in search results
WITH e,
     duration.inDays(e.timestamp, datetime()).days AS age_days,
     CASE WHEN e.status = 'exception' THEN 0.9
          WHEN e.status = 'completed' THEN 1.0
          WHEN e.status = 'denied' THEN 0.5
          ELSE 0.7 END AS base_confidence
OPTIONAL MATCH (e)-[:GOVERNED_BY]->(pol:Policy)
WITH e, age_days, base_confidence,
     CASE WHEN pol IS NULL THEN 1.0
          WHEN pol.version = $currentVersion THEN 1.0
          ELSE 0.1 END AS policy_currency
OPTIONAL MATCH (e)-[:RESULTED_IN]->(o:Outcome)
WITH e, age_days, base_confidence, policy_currency,
     CASE WHEN o IS NULL THEN 0.7
          WHEN o.type IN ['Recovered', 'customer_retained'] THEN 1.0
          WHEN o.type IN ['Improved'] THEN 0.8
          ELSE 0.3 END AS outcome_success

RETURN e,
       round(base_confidence
         * exp(-0.01 * age_days)
         * policy_currency
         * outcome_success, 2) AS relevance
ORDER BY relevance DESC
```

### 10.2 Integration with Search

The Cypher generator appends the relevance computation to every search query. The graph mapper passes relevance scores to the frontend:

```typescript
// In graph-mapper.ts
interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, unknown>;
  relevance: number;  // 0-1 score
}
```

### 10.3 Frontend Rendering

```typescript
// In ContextGraph.tsx — node style based on relevance
const nodeStyle = (relevance: number) => ({
  opacity: 0.3 + (relevance * 0.7),           // Low relevance = dimmed
  transform: `scale(${0.8 + relevance * 0.4})`, // Low relevance = smaller
  border: relevance > 0.8 ? '2px solid #10b981' : '1px solid #374151',
});

// Relevance badge on each node
<div className="absolute -top-2 -right-2 bg-gray-800 text-xs px-1.5 py-0.5 rounded-full">
  {(relevance * 100).toFixed(0)}
</div>
```

### 10.4 Timeline Integration

Timeline entries also show relevance. Filter control:
```
[Show all] [High relevance (>0.7)] [Critical only (>0.9)]
```

Low-relevance timeline entries are collapsed by default with a "Show N older/low-relevance events" toggle.

---

## 17. Seed Data

### 8.1 Retail Seed (verticals/retail/seed.ts)

50 users, 20 products, 5 agents, 4 policies. Same as previous LLD — Myntra-style journeys with embedded patterns (Nike sizing, EORS spike, Gold tier exceptions, COD-return correlation).

### 8.2 Healthcare Seed (verticals/healthcare/seed.ts)

**50 patients across 5 departments:**

| Department | Patients | Key Conditions |
|---|---|---|
| Cardiology (15) | Acute MI, Angina, Heart Failure, Arrhythmia | STEMI, NSTEMI, post-PCI complications |
| Orthopedics (10) | Fractures, Knee Replacement, Spine Surgery | Post-surgical rehab, insurance issues |
| General Medicine (10) | Diabetes, Hypertension, Infections | Medication management, chronic care |
| Emergency (10) | Trauma, Chest Pain, Stroke, Respiratory | Triage patterns, department transfers |
| Neurology (5) | Stroke, Epilepsy, Migraine | Consult wait times, protocol adherence |

**15 providers:**

| Provider | Dept | Pattern |
|---|---|---|
| Dr. Sharma | Cardiology | Deviates from STEMI protocol 30% — but 15% better outcomes |
| Dr. Patel | Cardiology | Follows protocol strictly — average outcomes |
| Dr. Iyer | Orthopedics | High insurance approval rate (pre-auth always filed) |
| Dr. Mehta | Orthopedics | 40% claim denial rate (often skips pre-auth) |
| Dr. Reddy | General Medicine | Aggressive medication switches |
| Dr. Nair | Neurology | Consult wait time > 4 hours causing ER bottleneck |

**Embedded patterns:**

1. **Readmission cluster:** 4 cardiac patients readmitted within 30 days — missed follow-up angiogram per Protocol v2.1
2. **Stent batch issue:** 3 patients with same DES stent type developed in-stent restenosis
3. **Insurance denial pattern:** Knee replacement claims denied 60% when pre-auth not filed (Dr. Mehta's patients)
4. **Medication switch pattern:** 5 diabetic patients went from metformin → insulin after ER visit, but protocol says try dose increase first
5. **ER bottleneck:** Neurology consult wait > 4 hours → 3x longer ER stays → 2 patients left without being seen
6. **Protocol drift:** Dr. Sharma skips 2-week follow-up scheduling 70% of time — but his patients have lower readmission rate than department average
7. **Department load:** Cardiology at 140% capacity, Orthopedics at 80%

**Journey templates:**

**Template A: Standard Visit (40%)**
```
Patient → Emergency Visit → Diagnosis → Treatment → Medication
→ Outcome (Recovered) → Insurance Claim (Approved) → Follow-up Visit
```

**Template B: Readmission (20%)**
```
Patient → Visit → Treatment → Discharge → [gap] → Readmission
→ New Diagnosis → New Treatment → Outcome
```

**Template C: Chronic Management (20%)**
```
Patient → Outpatient Visit 1 → Diagnosis → Medication A
→ Follow-up Visit 2 → Medication adjustment
→ Follow-up Visit 3 → Medication switch (A → B)
→ ER Visit (complication) → Treatment → Stabilized
```

**Template D: Insurance Denied (20%)**
```
Patient → Visit → Treatment → Insurance Claim (Denied)
→ Re-submission with pre-auth → Approved (or) Denied again
→ Appeal → Outcome
```

---

## 18. Frontend Components

### 9.1 Dashboard Layout (Vertical-Aware)

```
┌──────────────────────────────────────────────────────────────┐
│  ContextMesh  [Retail ▾ / Healthcare]     [Settings] [User] │
├──────────────────────────────────────────────────────────────┤
│  🔍 [Universal Search Bar ................................] │
│  [Filter1 ▾] [Filter2 ▾] [Filter3 ▾] [Date Range ▾]        │
│  Suggestions: "readmissions within 30 days" · "Dr. Sharma"  │
├─────────────────────────────┬────────────────────────────────┤
│                             │                                │
│     CONTEXT GRAPH           │    EVENT TIMELINE              │
│     (React Flow)            │    (Vertical-aware labels)     │
│                             │                                │
│     Colors + node shapes    │    Aggregated by day/week      │
│     adapt to vertical       │    Click syncs with graph      │
│                             │                                │
├─────────────────────────────┴────────────────────────────────┤
│  INSIGHT PANEL (plan-gated)                                  │
│  ┌──────────┐  ┌────────────────┐  ┌──────────────────────┐ │
│  │ Context  │  │   Reasoning    │  │      Result          │ │
│  │ 5 data   │  │   Step 1: ...  │  │  Finding: ...        │ │
│  │ points   │  │   Step 2: ...  │  │  Recommendation: ... │ │
│  │          │  │   Step 3: ...  │  │  Confidence: 0.87    │ │
│  └──────────┘  └────────────────┘  └──────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 Key Component Changes

**SearchBar.tsx** — shows vertical-specific sample queries as suggestions
**ContextGraph.tsx** — loads colors from `getVertical(orgVertical).colors`
**FilterBar.tsx** — loads filters from `getVertical(orgVertical).filters`
**InsightPanel.tsx** — three-column layout showing context / reasoning / result
**PlanGate.tsx** — wrapper component:
```tsx
<PlanGate feature="insights" fallback={<UpgradePrompt />}>
  <InsightPanel data={insight} />
</PlanGate>
```
**OrgSwitcher.tsx** — dropdown to switch between orgs (for demo: "Myntra Demo" ↔ "City Hospital Demo")

---

## 19. Data Flow Sequences

### 10.1 Onboarding

```
User                  API                    SQLite          Neo4j
  │                    │                       │               │
  ├─ Sign up ─────────▶│                       │               │
  │                    ├─ Create User ─────────▶│               │
  │                    │                       │               │
  ├─ Create Org ──────▶│                       │               │
  │  { name, vertical} ├─ Create Org + ────────▶│               │
  │                    │  generate tenantId    │               │
  │                    │                       │               │
  │                    ├─ Load vertical schema ─────────────────▶│
  │                    │  Shared: Profile +    │               │
  │                    │  Identity constraints │               │
  │                    │  + vertical-specific  │               │
  │                    │  indexes              │               │
  │                    │                       │               │
  │                    ├─ Seed demo data ──────────────────────▶│
  │                    │  (50 journeys with    │               │
  │                    │  identity resolution) │               │
  │                    │◀──────────────────────────── done ────┤
  │                    │                       │               │
  │◀── Redirect to ───┤                       │               │
  │    dashboard       │                       │               │
```

### 10.2 Event Ingestion (with Identity Resolution)

```
Client               API                  IdentityResolver       Neo4j
  │                    │                        │                   │
  ├─ POST /api/events ▶│                        │                   │
  │  { identifiers:    │                        │                   │
  │    {email, phone}, │                        │                   │
  │    event_type,     │                        │                   │
  │    product, ... }  │                        │                   │
  │                    ├─ Zod validate          │                   │
  │                    │                        │                   │
  │                    ├─ resolveIdentity() ────▶│                   │
  │                    │  (email, phone,        │                   │
  │                    │   tenantId)            │                   │
  │                    │                        ├─ Lookup ─────────▶│
  │                    │                        │  identities       │
  │                    │                        │◀── 1 profile ────┤
  │                    │                        │  (or 0, or 2+)   │
  │                    │                        │                   │
  │                    │                        ├─ If 0: CREATE ───▶│
  │                    │                        │  Profile+Identity │
  │                    │                        │                   │
  │                    │                        ├─ If 2+: MERGE ──▶│
  │                    │                        │  reparent events  │
  │                    │                        │  merge profiles   │
  │                    │                        │                   │
  │                    │◀── profile_id ─────────┤                   │
  │                    │                        │                   │
  │                    ├─ Create Event + ───────────────────────────▶│
  │                    │  linked nodes         │                   │
  │                    │  (Product, Payment,   │                   │
  │                    │   Policy, Agent...)   │                   │
  │                    │                       │                   │
  │                    ├─ Link Profile→Event ──────────────────────▶│
  │                    │  + NEXT chain         │                   │
  │                    │◀──────────────────────────── done ────────┤
  │                    │                       │                   │
  │◀── 201 {event_id, ┤                       │                   │
  │    profile_id,     │                       │                   │
  │    resolution}     │                       │                   │
```

### 10.3 Search (with tenant + vertical scoping)

```
User                   API                   Groq              Neo4j
  │                     │                      │                  │
  ├─ POST /api/search ─▶│                      │                  │
  │                     ├─ Get org (session)   │                  │
  │                     │  vertical + tenantId │                  │
  │                     │                      │                  │
  │                     ├─ Load vertical prompt ▶│                  │
  │                     │  (Profile + Identity  │                  │
  │                     │   schema + examples)  │                  │
  │                     │  + inject tenantId    │                  │
  │                     │                      ├─ Generate        │
  │                     │                      │  Cypher          │
  │                     │◀── cypher ───────────┤                  │
  │                     │                      │                  │
  │                     ├─ Validate + execute ────────────────▶│
  │                     │◀── results ─────────────────────────┤
  │                     │                      │                  │
  │                     ├─ mapNeo4jToGraph()   │                  │
  │                     │  (vertical colors,   │                  │
  │                     │   Profile as person  │                  │
  │                     │   node)              │                  │
  │                     │                      │                  │
  │◀── { nodes, edges, ┤                      │                  │
  │    timeline }       │                      │                  │
```

---

## 20. Error Handling

| Scenario | Handling |
|---|---|
| Unauthenticated request | 401 + redirect to sign in |
| Wrong org / no access | 403 + "Not authorized for this org" |
| Feature above plan tier | 403 + "Upgrade to Pro/Enterprise" with plan comparison |
| Invalid event payload | 400 + Zod error details |
| LLM generates invalid Cypher | Retry once with refined prompt → fallback to structured search |
| Cypher missing tenant filter | Reject — never execute unscoped queries |
| Neo4j connection failure | 500 + retry once + log |
| Empty results | 200 + empty graph + "No results found" |

---

## 21. Security

| Concern | Mitigation |
|---|---|
| **Tenant isolation** | Every Cypher query includes `_tenant` filter. Validated server-side before execution. |
| **Cypher injection** | LLM output validated — only read operations. Blocked keyword list (DELETE, CREATE, SET, etc.). |
| **Auth bypass** | NextAuth.js session required on all /api/* routes except auth endpoints. |
| **Plan bypass** | Plan checks server-side in API routes, not just frontend. |
| **Healthcare data** | All demo data is synthetic. Production roadmap includes HIPAA. |
| **XSS** | React auto-escapes all rendered data. No dangerouslySetInnerHTML. |
| **Env secrets** | .env.local gitignored. Server-side only. |

---

## 22. Performance Targets

| Metric | Target |
|---|---|
| Event ingestion (single) | < 200ms |
| Event ingestion (batch 1000) | < 2s |
| Identity resolution (per event) | < 100ms |
| Search (LLM + query) | < 3s |
| Search (basic text, Starter plan) | < 500ms |
| Vector similarity search | < 2s |
| Pattern discovery (community detection) | < 5s |
| Node re-center | < 1s |
| LLM insight (summary) | < 3s |
| LLM insight (full reasoning) | < 5s |
| Relevance scoring (computed at query time) | < 50ms overhead |
| Graph render (50 nodes) | < 500ms |
| Graph render (100 nodes) | < 1s |
| Onboarding + seed | < 30s |

---

## 23. Deployment

```
┌────────────────────────┐     ┌────────────────────────┐
│   AWS / Vercel          │     │   Neo4j Aura (Free)    │
│                         │     │                        │
│   Next.js App           │────▶│   Graph DB + Vector    │
│   - Auth (NextAuth)     │bolt │   - Retail data        │
│   - API Routes          │ +s  │   - Healthcare data    │
│   - Dashboard           │     │   - Tenant-scoped      │
│   - Kafka Consumer      │     │                        │
│   - SQLite (Prisma)     │     └────────────────────────┘
│                         │
└───────────┬─────────────┘
            │
            │ HTTPS
            ▼
┌────────────────────────┐     ┌────────────────────────┐
│   Groq Cloud API       │     │   Upstash Kafka        │
│   llama-3.3-70b        │     │   (Serverless)         │
└────────────────────────┘     │                        │
                               │   Topics per tenant    │
                               │   REST API             │
                               │   Free: 10K msgs/day   │
                               └────────────────────────┘
```

**Environment Variables:**
```
# Neo4j
NEO4J_URI=neo4j+s://xxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=xxx

# Groq LLM
GROQ_API_KEY=gsk_xxx

# Upstash Kafka
UPSTASH_KAFKA_REST_URL=https://xxx.upstash.io
UPSTASH_KAFKA_REST_USERNAME=xxx
UPSTASH_KAFKA_REST_PASSWORD=xxx

# NextAuth
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://contextmesh.vercel.app
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

**Free Tier Limits:**

| Service | Free Tier | Our Usage | Headroom |
|---|---|---|---|
| Neo4j Aura | 200K nodes, 400K rels | ~7K nodes | 96% |
| Upstash Kafka | 10K messages/day | ~200/demo | 98% |
| Groq | 30 req/min, 14K/day | ~50/demo | 99% |

**Neo4j Aura:**
- Retail: ~50 profiles × 15 events × 5 context nodes + commitments = ~4.5K nodes
- Healthcare: ~50 profiles × 8 visits × 6 context nodes + commitments = ~3.5K nodes
- Total: ~8K nodes — well within limits
