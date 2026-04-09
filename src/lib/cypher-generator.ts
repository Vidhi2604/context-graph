import { chatCompletion } from "./groq";
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

  const raw = await chatCompletion(
    prompt,
    `Translate this search to a Cypher query (limit ${limit}): "${query}"\n\nReturn ONLY valid JSON: {"cypher": "...", "interpretation": "...", "cypher_confidence": 0.0-1.0}`,
    { temperature: 0.1, maxTokens: 1024 }
  );

  try {
    // Try to parse as JSON first
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const validation = validateCypher(parsed.cypher);

    if (!validation.valid) {
      return { ...parsed, isValid: false, error: validation.error };
    }

    // Ensure tenant filter is present — check for _tenant property, not literal value
    if (!parsed.cypher.includes("_tenant")) {
      return { ...parsed, isValid: false, error: "Missing _tenant filter" };
    }

    // Replace any placeholder with actual tenantId for execution
    parsed.cypher = parsed.cypher
      .replace(/\{tenantId\}/g, tenantId)
      .replace(/\$tenantId/g, `"${tenantId}"`);

    return { ...parsed, isValid: true };
  } catch {
    // If JSON parse fails, try to extract Cypher directly
    const cypherMatch = raw.match(/MATCH[\s\S]+LIMIT\s+\d+/i);
    if (cypherMatch) {
      const cypher = cypherMatch[0];
      const validation = validateCypher(cypher);
      return {
        cypher,
        interpretation: query,
        cypher_confidence: 0.5,
        isValid: validation.valid,
        error: validation.error,
      };
    }
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

RELATIONSHIPS (${config.id === "retail" ? "Retail" : "Healthcare"}):
${config.id === "retail" ? RETAIL_RELS : HEALTHCARE_RELS}

IDENTITY RESOLUTION:
- When searching by email/phone/device_id/mrn, match via Identity:
  MATCH (i:Identity {value: $searchValue, _tenant: "{tenantId}"})<-[:HAS_IDENTITY]-(p:Profile)
- When searching by name/tier/city, match on Profile:
  MATCH (p:Profile {_tenant: "{tenantId}"}) WHERE p.name CONTAINS $searchValue

IMPORTANT:
- Every query MUST filter by _tenant = "{tenantId}" (use this exact placeholder, it will be replaced)
- Only use READ operations (MATCH, RETURN, WHERE, ORDER, LIMIT, OPTIONAL MATCH, WITH, UNWIND)
- Always include LIMIT
- Return full nodes for graph rendering

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
