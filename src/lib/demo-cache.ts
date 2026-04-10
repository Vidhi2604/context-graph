/**
 * demo-cache.ts — Pre-built demo responses for common queries.
 * Activated by DEMO_MODE=true env var.
 * Responses include _tenant placeholder replaced at query time.
 * Each tenant gets its own scoped demo response — no cross-tenant leakage.
 */

function buildDemoGraph(tenantId: string, cypher: string) {
  return {
    cypher: cypher.replace(/\{tenantId\}/g, tenantId),
    nodes: [],
    edges: [],
    edgesTruncated: false,
    timeline: [],
    centerNodeId: "",
    summary: { total_nodes: 0, total_edges: 0, node_breakdown: {} },
  };
}

const DEMO_QUERIES: Record<string, string> = {
  "Gold tier returns in Bangalore":
    'MATCH (p:Profile {tier:"Gold",city:"Bangalore",_tenant:"{tenantId}"})-[:PERFORMED]->(e:Event {event_type:"return_initiated"}) RETURN p,e LIMIT 50',
  "Nike returns last 90 days":
    'MATCH (p:Profile {_tenant:"{tenantId}"})-[:PERFORMED]->(e:Event {event_type:"return_initiated"})-[:INVOLVES]->(prod:Product) WHERE prod.brand="Nike" AND e.timestamp >= datetime()-duration("P90D") RETURN p,e,prod LIMIT 50',
  "Patients readmitted within 30 days":
    'MATCH (p:Profile {_tenant:"{tenantId}"})-[:READMITTED]->(v:Visit) WHERE v.timestamp >= datetime()-duration("P30D") RETURN p,v LIMIT 50',
  "Policy exceptions last 90 days":
    'MATCH (p:Profile {_tenant:"{tenantId}"})-[:PERFORMED]->(e:Event)-[:OVERRODE]->(pol:Policy) WHERE e.timestamp >= datetime()-duration("P90D") RETURN p,e,pol LIMIT 50',
};

export function getDemoResponse(query: string, tenantId: string): unknown | null {
  if (process.env.DEMO_MODE !== "true") return null;
  const cypher = DEMO_QUERIES[query];
  if (!cypher) return null;
  return buildDemoGraph(tenantId, cypher);
}
