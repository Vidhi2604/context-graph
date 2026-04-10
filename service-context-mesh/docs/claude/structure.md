# Context Graph Structure
### It's Not Per-User OR Per-Action — It's One Connected Graph With Multiple Query Dimensions

---

## The Wrong Mental Model

If you think of a context graph as "a database per user" or "a database per action type," you're thinking in tables. That's the CRM model. It's flat.

The whole point of a graph is that **a single decision trace connects to multiple dimensions simultaneously**, and you can query from any entry point and traverse to any other.

---

## The Right Mental Model

Think of it as ONE graph per client company (e.g., one graph for Myntra). Inside that graph, every decision trace is a node connected to:

```
                    ┌──────────────┐
                    │   CUSTOMER   │ ← "Show me everything about Priya"
                    │   (per-user) │
                    └──────┬───────┘
                           │
   ┌───────────────┐       │        ┌───────────────┐
   │    POLICY     │───────┼────────│    ACTION      │
   │ (per-rule)    │       │        │  (per-type)    │
   └───────────────┘       │        └───────────────┘
           ↑               │               ↑
           │        ┌──────┴───────┐       │
           └────────│   DECISION   │───────┘
                    │    TRACE     │
           ┌────────│   #4829      │───────┐
           │        └──────┬───────┘       │
           ↓               │               ↓
   ┌───────────────┐       │        ┌───────────────┐
   │    AGENT      │───────┼────────│   PRODUCT     │
   │ (per-person)  │       │        │  (per-item)   │
   └───────────────┘       │        └───────────────┘
                           │
                    ┌──────┴───────┐
                    │   OUTCOME    │ ← "Was this decision successful?"
                    │ (per-result) │
                    └──────────────┘
```

**One trace. Six connections. Each connection enables a different type of query.**

---

## Concrete Example: Myntra Return Decision

A customer calls about a return. Here's the single decision trace that gets created:

```
Decision Trace #4829
├── WHO: Customer Priya M. (Gold Insider, ₹1.2L LTV, 3 prior returns)
├── WHAT: Late return exception — product returned on Day 37 (policy: 30 days)
├── WHICH PRODUCT: Nike Air Max, ₹8,499, ordered during EORS
├── WHICH POLICY: Return Policy v3.2 — 30-day window
├── EXCEPTION: Approved — 7 days past window
├── WHY: Gold tier + high LTV + first late return + product unused
├── WHO DECIDED: AI agent (auto-approved, confidence 0.87)
├── PRECEDENT USED: Trace #3901, #4102 (similar Gold tier exceptions)
└── OUTCOME: Customer retained, product resold at 60% value
```

This single trace now sits in the graph connected to ALL of these dimensions.

---

## What Each Dimension Answers

### Per-User Queries
**Entry point:** "Tell me about Customer Priya M."

The graph returns everything connected to Priya's node:
- Her 47 orders, 3 returns, 1 complaint
- Every decision made about her account
- Commitments made to her ("we promised free exchange on her next order")
- Her sentiment trajectory (happy → frustrated → resolved)
- Predicted churn risk based on decision patterns

**Who asks this:** Agent handling Priya's next call. CSM reviewing her account. AI bot preparing for her interaction.

**What existing systems do:** CRM shows order history. Ticketing shows past tickets. But NEITHER shows the reasoning behind past decisions — why the exception was granted, what precedent was used, what was promised.

### Per-Action Queries
**Entry point:** "Show me all late return exceptions"

The graph returns every trace where a late return was approved or denied:
- 847 such decisions in the last 90 days
- 72% approval rate
- Average customer who gets approved: Gold/Platinum, LTV > ₹80K
- Average customer who gets denied: Silver/Bronze, LTV < ₹30K
- Outcomes: 89% of approved customers made another purchase within 60 days
- Emerging pattern: "Late returns during EORS are approved 91% of the time regardless of tier"

**Who asks this:** Operations manager optimizing return policy. Finance team quantifying exception cost. Training team building agent playbooks.

**This is where the real money is.** Per-action analysis reveals patterns invisible in any other system — because no other system captures the reasoning across hundreds of similar decisions.

### Per-Policy Queries
**Entry point:** "How is Return Policy v3.2 actually being applied?"

The graph returns:
- Policy says 30-day window, no exceptions
- Reality: overridden 72% of the time for Gold+ customers
- 12 different informal rules have emerged (none documented)
- This policy has drifted so far from written form that it's effectively unenforced
- Recommendation: Rewrite to match actual practice (extend to 45 days for Gold+)

**Who asks this:** Compliance team. Policy owner. VP Operations.

**This is the Tribal Knowledge Extractor in action.** The graph surfaces what the policy SAYS vs. what actually HAPPENS — and nobody else can do this.

### Per-Agent Queries
**Entry point:** "How does Agent Ravi K. compare to the team?"

The graph returns:
- Ravi approves exceptions 68% of the time (team average: 55%)
- BUT his customer retention rate is 91% (team average: 78%)
- His exception decisions cost ₹12K more per month but retain ₹3.2L more in customer value
- Ravi's decision patterns should probably become the team's training material

**Who asks this:** Team lead. QA manager. Training team. Agent performance review.

### Per-Product Queries
**Entry point:** "Show me all decisions related to Nike Air Max returns"

The graph returns:
- This specific product has a 34% return rate (category average: 22%)
- Top return reason: "size runs small" (mentioned in 67% of traces)
- Agents have been approving exchanges without size guide verification
- 4 brand escalations filed but no action from Nike team
- Recommendation: Add size warning to product page, escalate to brand partner team

**Who asks this:** Category manager. Brand relationship manager. Product team.

### Per-Vertical / Per-Industry Queries (Cross-Client)
**Entry point:** "How do fashion e-commerce return rates compare across our clients?"

The graph returns (anonymized, opt-in only):
- Client A (fashion): 28% return rate, 65% exception approval rate
- Client B (fashion): 35% return rate, 45% exception approval rate
- Client C (electronics): 12% return rate, 30% exception approval rate
- Fashion industry pattern: Late return exceptions for high-LTV customers are nearly universal
- Benchmark: Client A's 89% retention on approved exceptions is best-in-class

**Who asks this:** Your product team (to improve ContextMesh). Clients (to benchmark themselves).

---

## How This Applies Differently to Your Three Clients

### Myntra: Action-Heavy
The highest-value queries will be **per-action** — understanding patterns across thousands of return decisions, pricing exceptions, and brand escalations. Per-user context enriches individual conversations, but the strategic value is in the aggregate action patterns.

Key graph queries Myntra will run:
- "What's our actual return policy for Gold customers?" (per-policy)
- "How should we handle Day-35 returns for orders above ₹5K?" (per-action + precedent)
- "Why is this customer calling for the 4th time?" (per-user)
- "Which products have the highest exception-driven return rate?" (per-product)

### Infosys: Agent-and-Knowledge-Heavy
The highest-value queries will be **per-agent** and **per-engagement** — understanding how different consultants and AI agents make decisions, capturing institutional knowledge, and reducing knowledge loss from turnover.

Key graph queries Infosys will run:
- "How did we solve this type of problem for a similar BFSI client?" (per-action pattern)
- "What approach did the team use for SAP migration at Company X, and how did it go?" (per-engagement)
- "This AI agent approved 15 invoice exceptions today — are they consistent with past practice?" (per-agent governance)
- "Senior architect Raman is leaving — what decision patterns from his projects should we capture?" (per-agent knowledge extraction)

### ICICI Bank: Compliance-and-User-Heavy
The highest-value queries will be **per-user** (customer 360 across ICICI entities) and **per-policy** (how regulations are actually being applied across 6,000 branches).

Key graph queries ICICI will run:
- "Show me every credit decision exception at the Mumbai branch this quarter and the regulatory basis for each" (per-policy + per-location)
- "This customer has a loan with ICICI Bank, insurance with Lombard, and investments with Securities — what's the full relationship context?" (per-user cross-entity)
- "How are we applying RBI Circular X across all branches? Any inconsistencies?" (per-policy)
- "This AML flag has been cleared 12 times for similar patterns — can we create a pre-approved rule?" (per-action → policy recommendation)

---

## The Technical Architecture: One Graph, Multiple Query Paths

```
┌────────────────────────────────────────────────────────────┐
│                 MYNTRA CONTEXT GRAPH                        │
│                 (one graph per client)                      │
│                                                            │
│   Node Types:                                              │
│   ● Customer    ● Product    ● Order      ● Agent          │
│   ● Policy      ● Brand     ● Decision   ● Outcome        │
│   ● Commitment  ● Season    ● Campaign                     │
│                                                            │
│   Edge Types (relationships):                              │
│   → placed_order    → returned_product   → applied_policy  │
│   → made_exception  → approved_by        → similar_to      │
│   → resulted_in     → referenced_precedent                 │
│   → committed_to    → escalated_to       → belongs_to_tier │
│                                                            │
│   Query Paths:                                             │
│   Per-user:    Customer → Orders → Decisions → Outcomes    │
│   Per-action:  Decision_Type → All_Traces → Patterns       │
│   Per-policy:  Policy → All_Applications → Drift_Analysis  │
│   Per-agent:   Agent → Decisions → Consistency_Score       │
│   Per-product: Product → Returns → Root_Causes             │
│                                                            │
│   All paths traverse the SAME underlying graph.            │
│   Different entry points, same connected data.             │
└────────────────────────────────────────────────────────────┘
```

### Storage Structure

| Level | What It Is | Isolation | Example |
|---|---|---|---|
| **Tenant** | One per client company | Fully isolated (separate DB or schema) | Myntra tenant, ICICI tenant |
| **Graph** | One per tenant | Contains all nodes and edges | Myntra's full context graph |
| **Node** | One per entity | Connected via edges | Customer Priya, Policy v3.2, Nike Air Max |
| **Trace** | One per decision | Connected to multiple nodes | Trace #4829 (the return exception) |

There is NO separate "per-user graph" or "per-action graph." There's ONE graph where you can **enter through any dimension and traverse to any other.**

That's the entire point. A CRM is per-user. A knowledge base is per-policy. A ticketing system is per-ticket. **A context graph is all of them connected — and the connections are where the intelligence lives.**

---

## The Bottom Line

When Myntra asks "should we build a context graph for returns?" — the answer is: **you build ONE context graph for Myntra. Return decisions are one of many trace types that flow into it. The graph gets smarter about returns, but also about customers, products, policies, agents, and brands — because they're all connected.**

The per-action view (returns) is a query path INTO the graph, not a separate graph. And the magic happens when you cross dimensions: "customers who got return exceptions AND later upgraded to Gold tier AND bought from the same brand again" — that's a three-hop traversal that no flat database can answer, but a context graph returns in milliseconds.