import { claudeExtract } from "./llm";
import { getVertical } from "@/verticals/registry";

const BLOCKED_KEYWORDS = [
  "DELETE", "DETACH", "DROP", "CREATE", "SET",
  "MERGE", "REMOVE", "CALL", "LOAD CSV", "FOREACH",
];

interface CypherResult {
  cypher: string;
  interpretation: string;
  cypher_confidence: number;
  isValid: boolean;
  error?: string;
}

export async function generateCypher(
  query: string,
  tenantId: string,
  vertical: string,
  limit: number = 50
): Promise<CypherResult> {
  const config = getVertical(vertical);
  const prompt = buildPrompt(config);

  // claudeExtract returns parsed JSON directly
  const raw = await claudeExtract(
    `Translate this search to a Cypher query (limit ${limit}): "${query}"\n\nReturn ONLY valid JSON: {"cypher": "...", "interpretation": "...", "cypher_confidence": 0.0-1.0}`,
    prompt
  ) as { cypher?: string; interpretation?: string; cypher_confidence?: number };

  const cypher = raw.cypher ?? "";
  const interpretation = raw.interpretation ?? query;
  const confidence = raw.cypher_confidence ?? 0;

  if (!cypher) {
    return { cypher: "", interpretation, cypher_confidence: 0, isValid: false, error: "No Cypher returned" };
  }

  try {
    const validation = validateCypher(cypher);

    if (!validation.valid) {
      return { cypher, interpretation, cypher_confidence: confidence, isValid: false, error: validation.error };
    }

    if (!cypher.includes("_tenant")) {
      return { cypher, interpretation, cypher_confidence: confidence, isValid: false, error: "Missing _tenant filter" };
    }

    // Replace placeholders with actual tenantId
    const finalCypher = cypher
      .replace(/\{tenantId\}/g, tenantId)
      .replace(/\$tenantId/g, `"${tenantId}"`);

    return { cypher: finalCypher, interpretation, cypher_confidence: confidence, isValid: true };
  } catch {
    return {
      cypher: "",
      interpretation: query,
      cypher_confidence: 0,
      isValid: false,
      error: "Failed to generate Cypher query",
    };
  }
}

function validateCypher(cypher: string): { valid: boolean; error?: string } {
  const upper = cypher.toUpperCase();
  for (const keyword of BLOCKED_KEYWORDS) {
    // Allow CASE...WHEN...THEN...END but block standalone mutation keywords
    if (keyword === "SET" || keyword === "CREATE" || keyword === "DELETE") {
      // Check it's not inside a CASE expression
      const idx = upper.indexOf(keyword);
      if (idx >= 0) {
        const before = upper.slice(Math.max(0, idx - 20), idx);
        if (!before.includes("CASE") && !before.includes("WHEN") && !before.includes("THEN")) {
          return { valid: false, error: `Blocked operation: ${keyword}` };
        }
      }
    } else if (upper.includes(keyword)) {
      return { valid: false, error: `Blocked operation: ${keyword}` };
    }
  }
  if (!upper.includes("LIMIT")) {
    return { valid: false, error: "Missing LIMIT clause" };
  }
  return { valid: true };
}

// tenantId is NOT embedded in prompt (security). LLM uses {tenantId} placeholder.
// Replacement happens in generateCypher() after validation.
function buildPrompt(config: VerticalConfig): string {
  const nodeSchemas = config.nodeTypes
    .map((n) => {
      const props = n.properties.map((p) => p.name).join(", ");
      return `- (:${n.label} {${props}, _tenant})`;
    })
    .join("\n");

  return `You are a Neo4j Cypher query generator for a ${config.name.toUpperCase()} context graph.

GRAPH SCHEMA:
- (:Profile {profile_id, name, _tenant, ...vertical-specific attributes})
- (:Identity {identity_id, type, value, source, verified, strength, _tenant})
${nodeSchemas}

EVENT NODE PROPERTIES (retail):
- event_type: "purchase" | "return_initiated" | "refund_issued" | "product_view" | "add_to_cart" | "support_ticket" | "review_submitted"
- method: "COD" | "UPI" | "Credit Card" | "Debit Card"  ← payment method is HERE on Event, NOT on a Payment node
- amount: number (order value in rupees)
- channel: "web" | "mobile" | "store"  ← NOT the payment method
- status: "completed" | "pending" | "failed"
- exception: boolean

RELATIONSHIPS (${config.id === "retail" ? "Retail" : "Healthcare"}):
${config.id === "retail" ? RETAIL_RELS : HEALTHCARE_RELS}

IDENTITY RESOLUTION:
- When searching by email/phone/device_id/mrn, match via Identity:
  MATCH (i:Identity {value: $searchValue, _tenant: "{tenantId}"})<-[:HAS_IDENTITY]-(p:Profile)
- When searching by name/tier/city, match on Profile using case-insensitive toLower():
  MATCH (p:Profile {_tenant: "{tenantId}"}) WHERE toLower(p.name) CONTAINS toLower($searchValue)
- ALWAYS use toLower() for any string comparisons (name, city, tier, event_type, etc.) to ensure case-insensitive search

CRITICAL RULES:
- Every query MUST filter by _tenant = "{tenantId}"
- Only READ operations (MATCH, RETURN, WHERE, ORDER, LIMIT, OPTIONAL MATCH, WITH, UNWIND)
- Always include LIMIT
- ALWAYS return connected context — not just top-level nodes. Use OPTIONAL MATCH to fetch:
  * For retail: Profile → Events → Products, Payments, Policies, Agents
  * For healthcare: Profile → Visits → Diagnoses, Treatments, Providers, Protocols

GRAPH CONTEXT RULE (very important):
Every query MUST return PATH objects so edges are included in the graph. Never return just nodes.
CRITICAL: Only use path variables for patterns you have already matched. Never reference a path variable unless the node it contains was matched in the same or prior MATCH/OPTIONAL MATCH clause.

Bad example (DO NOT DO):
  MATCH (p:Profile {_tenant:"{tenantId}"}) WHERE p.tier = 'Gold'
  OPTIONAL MATCH path4 = (v)-[:ATTENDED_BY]->(prov:Provider)  ← ERROR: v not defined here
  RETURN p, path4

Good example (DO THIS):
  MATCH (p:Profile {_tenant:"{tenantId}"}) WHERE p.tier = 'Gold' AND p.city = 'Bangalore'
  WITH p LIMIT 50
  OPTIONAL MATCH path1 = (p)-[:PERFORMED]->(e:Event)
  OPTIONAL MATCH path2 = (e)-[:INVOLVES]->(prod:Product)
  RETURN p, path1, path2

ALWAYS use "OPTIONAL MATCH path = (...)" and include path variables in RETURN.
ALWAYS include the Profile node (p) directly in RETURN so graph expansion works.
NEVER use a variable in an OPTIONAL MATCH that was not defined in a previous MATCH or WITH clause.

TIMELINE RULE:
If query is aggregate (category/product/event type search), also return counts grouped by date:
  WITH e, count(e) as daily_count, date(e.timestamp) as day RETURN day, daily_count ORDER BY day

Return ONLY valid JSON: {"cypher": "MATCH ...", "interpretation": "what this query does", "cypher_confidence": 0.0-1.0}`;
}

const RETAIL_RELS = `(Profile)-[:HAS_IDENTITY]->(Identity)
(Profile)-[:PERFORMED]->(Event)-[:NEXT]->(Event)
(Profile)-[:HAS_SESSION]->(Session)-[:CONTAINS]->(Event)
(Profile)-[:HAS_COMMITMENT]->(Commitment)
(Event)-[:INVOLVES]->(Product)
(Event)-[:PAID_VIA]->(Payment)
(Event)-[:GOVERNED_BY]->(Policy)
(Event)-[:OVERRODE]->(Policy)
(Event)-[:HANDLED_BY]->(Agent)
(Event)-[:RESULTED_IN]->(Outcome)
(Event)-[:CREATED_COMMITMENT]->(Commitment)
(Policy)-[:SUPERSEDED_BY]->(Policy)`;

const HEALTHCARE_RELS = `(Profile)-[:HAS_IDENTITY]->(Identity)
(Profile)-[:HAD_VISIT]->(Visit)-[:NEXT]->(Visit)
(Profile)-[:READMITTED]->(Visit)
(Profile)-[:HAS_COMMITMENT]->(Commitment)
(Visit)-[:DIAGNOSED_WITH]->(Diagnosis)
(Visit)-[:TREATED_WITH]->(Treatment)
(Visit)-[:PRESCRIBED]->(Medication)
(Visit)-[:ATTENDED_BY]->(Provider)
(Visit)-[:GOVERNED_BY]->(Protocol)
(Visit)-[:DEVIATED_FROM]->(Protocol)
(Visit)-[:RESULTED_IN]->(Outcome)
(Visit)-[:CLAIMED_VIA]->(InsuranceClaim)
(Visit)-[:IN_DEPARTMENT]->(Department)
(Visit)-[:CREATED_COMMITMENT]->(Commitment)
(Diagnosis)-[:INDICATES]->(Treatment)
(Treatment)-[:USES]->(Medication)
(Provider)-[:BELONGS_TO]->(Department)
(Protocol)-[:SUPERSEDED_BY]->(Protocol)`;

// Need this import for the type
import { VerticalConfig } from "@/types/vertical";
