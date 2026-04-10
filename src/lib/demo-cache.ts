/**
 * demo-cache.ts — Pre-built Cypher for common queries.
 * All queries return paths so the graph mapper can extract edges.
 */

const DEMO_CYPHERS: Array<{ keywords: string[]; cypher: string }> = [
  // ── Retail ──────────────────────────────────────────────────────
  {
    keywords: ["gold", "return", "bangalore"],
    cypher: `MATCH path = (p:Profile {tier:"Gold",city:"Bangalore",_tenant:$tenantId})-[:PERFORMED]->(e:Event {event_type:"return_initiated"}) RETURN path LIMIT 50`,
  },
  {
    keywords: ["nike", "return"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:PERFORMED]->(e:Event {event_type:"return_initiated"})-[:INVOLVES]->(prod:Product) WHERE prod.brand="Nike" RETURN path LIMIT 50`,
  },
  {
    keywords: ["cart", "abandon"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:PERFORMED]->(e:Event {event_type:"add_to_cart"}) RETURN path LIMIT 50`,
  },
  {
    keywords: ["churn", "churned", "inactive"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:PERFORMED]->(e:Event) WHERE e.event_type IN ["support_ticket","return_initiated"] RETURN path LIMIT 50`,
  },
  {
    keywords: ["high value", "platinum", "top customer"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:PERFORMED]->(e:Event {event_type:"purchase"}) WHERE p.tier IN ["Gold","Platinum"] RETURN path LIMIT 50`,
  },
  {
    keywords: ["support", "ticket", "complaint"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:PERFORMED]->(e:Event {event_type:"support_ticket"}) RETURN path LIMIT 50`,
  },
  {
    keywords: ["policy", "exception", "override"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:PERFORMED]->(e:Event)-[:OVERRODE]->(pol:Policy) RETURN path LIMIT 50`,
  },
  {
    keywords: ["purchase", "buy", "bought", "order"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:PERFORMED]->(e:Event {event_type:"purchase"}) RETURN path LIMIT 50`,
  },
  // ── Healthcare ──────────────────────────────────────────────────
  {
    keywords: ["readmit", "readmission"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:HAD_VISIT]->(v:Visit) WITH p, count(v) AS visits, collect(path) AS paths WHERE visits > 1 UNWIND paths AS path RETURN path LIMIT 50`,
  },
  {
    keywords: ["emergency", "er visit"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:HAD_VISIT]->(v:Visit {type:"Emergency"}) RETURN path LIMIT 50`,
  },
  {
    keywords: ["diabetes", "diabetic"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:HAD_VISIT]->(v:Visit)-[:DIAGNOSED_WITH]->(d:Diagnosis) WHERE d.name CONTAINS "Diabetes" RETURN path LIMIT 50`,
  },
  {
    keywords: ["protocol", "deviation", "deviated"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:HAD_VISIT]->(v:Visit)-[:DEVIATED_FROM]->(pr:Protocol) RETURN path LIMIT 50`,
  },
  {
    keywords: ["insurance", "claim", "denied"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:HAD_VISIT]->(v:Visit)-[:CLAIMED_VIA]->(ic:InsuranceClaim) WHERE ic.status="Denied" RETURN path LIMIT 50`,
  },
  {
    keywords: ["cardiology", "cardiac", "heart", "dr. sharma"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:HAD_VISIT]->(v:Visit {department:"Cardiology"}) RETURN path LIMIT 50`,
  },
  {
    keywords: ["knee", "replacement", "orthopedic"],
    cypher: `MATCH path = (p:Profile {_tenant:$tenantId})-[:HAD_VISIT]->(v:Visit)-[:DIAGNOSED_WITH]->(d:Diagnosis) WHERE d.name CONTAINS "knee" OR d.name CONTAINS "Orthopedic" RETURN path LIMIT 50`,
  },
];

function scoreMatch(keywords: string[], query: string): number {
  const q = query.toLowerCase();
  return keywords.filter(k => q.includes(k.toLowerCase())).length;
}

export function getDemoResponse(
  query: string,
  tenantId: string
): { cypher: string; tenantId: string } | null {
  let best: { cypher: string; score: number } | null = null;

  for (const entry of DEMO_CYPHERS) {
    const score = scoreMatch(entry.keywords, query);
    if (score > 0 && (!best || score > best.score)) {
      best = { cypher: entry.cypher, score };
    }
  }

  if (!best) return null;
  return { cypher: best.cypher, tenantId };
}
