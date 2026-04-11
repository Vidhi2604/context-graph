import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import Anthropic from "@anthropic-ai/sdk";
import { getDriver } from "@/lib/neo4j";
import { v4 as uuidv4 } from "uuid";

const BATCH_SIZE = 500;
const MAX_ROWS = 100_000;

// Canonical fields we care about (both verticals)
interface CanonicalRow {
  profile_id: string;
  event_id: string;  // retail event or healthcare visit
  name?: string;
  email?: string;
  phone?: string;
  tier?: string;
  city?: string;
  ltv?: string;
  age?: string;
  gender?: string;
  insurance_provider?: string;
  // Event/Visit
  event_type?: string;
  type?: string;
  timestamp: string;
  amount?: string;
  channel?: string;
  status?: string;
  department?: string;
  priority?: string;
  duration_hours?: string;
  // Product (retail)
  product_id?: string;
  product_name?: string;
  brand?: string;
  category?: string;
  price?: string;
  payment_method?: string;
  // Agent (retail)
  agent_id?: string;
  agent_name?: string;
  // Diagnosis (healthcare)
  icd_code?: string;
  diagnosis_name?: string;
  severity?: string;
  chronic?: string;
  // Provider (healthcare)
  provider_id?: string;
  provider_name?: string;
  medication?: string;
  treatment_type?: string;
  treatment_cost?: string;
  // Claim (healthcare)
  claim_id?: string;
  claim_amount?: string;
  claim_status?: string;
  denial_reason?: string;
  confidence_score?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const isCSV = file.name.endsWith(".csv");
    const isTSV = file.name.endsWith(".tsv") || file.name.endsWith(".txt");
    if (!isCSV && !isTSV) {
      return NextResponse.json({ error: "Only .csv or .tsv files are supported" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
    }

    if (lines.length - 1 > MAX_ROWS) {
      return NextResponse.json(
        { error: `CSV exceeds maximum of ${MAX_ROWS.toLocaleString()} rows` },
        { status: 400 }
      );
    }

    // Auto-detect delimiter
    const firstLine = lines[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = tabCount > commaCount ? "\t" : ",";

    const headers = parseDelimitedLine(firstLine, delimiter);

    // Parse all rows
    const rawRows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseDelimitedLine(lines[i], delimiter);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h.trim()] = (values[idx] ?? "").trim();
        });
        rawRows.push(row);
      } catch {
        // skip malformed row
      }
    }

    // ── Step 1: AI column mapping (one call, ~200ms) ──────────────────────────
    const sampleRows = rawRows.slice(0, 3);
    const columnMapping = await mapColumnsWithAI(headers, sampleRows, session.vertical);

    // ── Step 2: Transform rows to canonical format ────────────────────────────
    const rows: CanonicalRow[] = rawRows.map((raw) => transformRow(raw, columnMapping, session.vertical));

    // ── Step 3: Bulk write to Neo4j with UNWIND ───────────────────────────────
    const { ingested, failed } = await bulkWriteNeo4j(rows, session.tenantId, session.vertical);

    return NextResponse.json({
      accepted: true,
      filename: file.name,
      total_rows: rows.length,
      total_ingested: ingested,
      total_failed: failed,
      total_skipped: 0,
      parse_errors: rawRows.length < lines.length - 1 ? lines.length - 1 - rawRows.length : 0,
      batch_errors: [],
      column_mapping: columnMapping,
    }, { status: 202 });

  } catch (error) {
    return errorResponse(error);
  }
}

// ── AI column mapping ─────────────────────────────────────────────────────────

async function mapColumnsWithAI(
  headers: string[],
  sampleRows: Record<string, string>[],
  vertical: string
): Promise<Record<string, string>> {
  // Fast path: try deterministic mapping first (handles well-named CSVs without an LLM call)
  const deterministicMapping = buildDeterministicMapping(headers, vertical);
  const unmappedCount = Object.values(deterministicMapping).filter((v) => !v).length;

  // If we mapped all required fields deterministically, skip the AI call
  const requiredFields = vertical === "retail"
    ? ["profile_id", "event_type", "timestamp"]
    : ["profile_id", "timestamp"];
  const allRequiredMapped = requiredFields.every((f) => !!deterministicMapping[f]);

  if (allRequiredMapped && unmappedCount <= 3) {
    return deterministicMapping;
  }

  // AI call for ambiguous columns
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are mapping CSV columns to a canonical schema for a ${vertical} platform.

CSV headers: ${JSON.stringify(headers)}
Sample rows (first 3):
${sampleRows.map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`).join("\n")}

Map each canonical field to the CSV column name that best represents it.
Return ONLY a JSON object. Use null if no matching column exists.

For ${vertical === "retail" ? "retail" : "healthcare"}, the canonical fields are:
${vertical === "retail" ? `{
  "profile_id": "<column with customer/profile ID>",
  "name": "<column with customer name>",
  "email": "<column with email>",
  "phone": "<column with phone>",
  "tier": "<column with customer tier/segment>",
  "city": "<column with city/location>",
  "ltv": "<column with lifetime value>",
  "event_type": "<column with event/action type>",
  "timestamp": "<column with date/time>",
  "amount": "<column with transaction amount>",
  "channel": "<column with sales channel>",
  "status": "<column with event status>",
  "product_id": "<column with product ID>",
  "product_name": "<column with product name>",
  "brand": "<column with brand>",
  "category": "<column with product category>",
  "price": "<column with product price>",
  "payment_method": "<column with payment method>",
  "agent_id": "<column with agent ID>",
  "agent_name": "<column with agent name>",
  "confidence_score": "<column with confidence score>"
}` : `{
  "profile_id": "<column with patient/profile ID>",
  "name": "<column with patient name>",
  "email": "<column with email>",
  "phone": "<column with phone>",
  "age": "<column with age>",
  "gender": "<column with gender>",
  "city": "<column with city>",
  "insurance_provider": "<column with insurance provider>",
  "type": "<column with visit type>",
  "timestamp": "<column with date/time>",
  "department": "<column with department>",
  "status": "<column with visit status>",
  "priority": "<column with priority>",
  "duration_hours": "<column with duration>",
  "icd_code": "<column with ICD code>",
  "diagnosis_name": "<column with diagnosis>",
  "severity": "<column with severity>",
  "chronic": "<column indicating chronic condition>",
  "provider_id": "<column with provider/doctor ID>",
  "provider_name": "<column with provider/doctor name>",
  "medication": "<column with medication>",
  "treatment_type": "<column with treatment type>",
  "treatment_cost": "<column with treatment cost>",
  "claim_id": "<column with claim ID>",
  "claim_amount": "<column with claim amount>",
  "claim_status": "<column with claim status>",
  "denial_reason": "<column with denial reason>",
  "confidence_score": "<column with confidence score>"
}`}

Return only the JSON object, no explanation.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiMapping = JSON.parse(jsonMatch[0]) as Record<string, string | null>;
      // Merge AI result with deterministic (AI takes priority for non-null)
      const merged: Record<string, string> = { ...deterministicMapping };
      for (const [canonical, csvCol] of Object.entries(aiMapping)) {
        if (csvCol && headers.includes(csvCol)) {
          merged[canonical] = csvCol;
        }
      }
      return merged;
    }
  } catch {
    // AI failed — fall back to deterministic
  }

  return deterministicMapping;
}

// Deterministic mapping: fuzzy-match by well-known names
function buildDeterministicMapping(headers: string[], vertical: string): Record<string, string> {
  const h = headers.map((x) => x.toLowerCase().trim());
  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = h.findIndex((x) => x === c || x.includes(c));
      if (idx >= 0) return headers[idx];
    }
    return "";
  };

  const base: Record<string, string> = {
    profile_id: find("profile_id", "patient_id", "customer_id", "user_id", "pat_", "prof_"),
    name: find("name", "full_name", "customer_name", "patient_name"),
    email: find("email", "email_address"),
    phone: find("phone", "mobile", "contact"),
    city: find("city", "location", "region"),
    timestamp: find("timestamp", "date", "created_at", "event_time", "visit_date"),
    status: find("status", "event_status", "visit_status"),
    confidence_score: find("confidence_score", "confidence", "score"),
  };

  if (vertical === "retail") {
    Object.assign(base, {
      tier: find("tier", "segment", "level"),
      ltv: find("ltv", "lifetime_value", "total_spend"),
      event_type: find("event_type", "type", "action", "event"),
      amount: find("amount", "transaction_amount", "value", "total"),
      channel: find("channel", "source", "medium"),
      product_id: find("product_id", "item_id", "sku"),
      product_name: find("product_name", "item_name", "product"),
      brand: find("brand", "brand_name"),
      category: find("category", "product_category", "dept"),
      price: find("price", "unit_price", "product_price"),
      payment_method: find("payment_method", "payment", "pay_method"),
      agent_id: find("agent_id", "rep_id"),
      agent_name: find("agent_name", "agent", "rep_name", "representative"),
    });
  } else {
    Object.assign(base, {
      visit_id: find("visit_id", "encounter_id", "episode_id"),
      age: find("age", "patient_age"),
      gender: find("gender", "sex"),
      insurance_provider: find("insurance_provider", "insurance", "payer", "insurer"),
      type: find("type", "visit_type", "encounter_type"),
      department: find("department", "dept", "specialty", "unit"),
      priority: find("priority", "acuity", "urgency"),
      duration_hours: find("duration_hours", "duration", "hours", "los"),
      icd_code: find("icd_code", "icd", "diagnosis_code"),
      diagnosis_name: find("diagnosis_name", "diagnosis", "condition"),
      severity: find("severity", "severity_level"),
      chronic: find("chronic", "is_chronic", "chronic_condition"),
      provider_id: find("provider_id", "doctor_id", "physician_id"),
      provider_name: find("provider_name", "provider", "doctor", "physician"),
      medication: find("medication", "drug", "medicine", "rx"),
      treatment_type: find("treatment_type", "treatment", "procedure"),
      treatment_cost: find("treatment_cost", "cost", "procedure_cost"),
      claim_id: find("claim_id", "claim"),
      claim_amount: find("claim_amount", "claim_value", "billed_amount"),
      claim_status: find("claim_status", "insurance_status"),
      denial_reason: find("denial_reason", "denial", "reject_reason"),
    });
  }

  return base;
}

// ── Row transformation ────────────────────────────────────────────────────────

function transformRow(
  raw: Record<string, string>,
  mapping: Record<string, string>,
  vertical: string
): CanonicalRow {
  const get = (field: string) => {
    const col = mapping[field];
    return col ? (raw[col] ?? "") : "";
  };

  const profileId = get("profile_id") || `prof_${uuidv4().slice(0, 8)}`;
  const eventId = vertical === "retail"
    ? (get("event_id") || `evt_${uuidv4().slice(0, 8)}`)
    : (get("visit_id") || get("event_id") || `visit_${uuidv4().slice(0, 8)}`);

  const rawTs = get("timestamp");
  const timestamp = sanitizeTimestamp(rawTs);

  const row: CanonicalRow = {
    profile_id: profileId,
    event_id: eventId,
    timestamp,
  };

  const textFields = [
    "name", "email", "phone", "tier", "city", "ltv", "age", "gender", "insurance_provider",
    "event_type", "type", "amount", "channel", "status", "department", "priority", "duration_hours",
    "product_id", "product_name", "brand", "category", "price", "payment_method",
    "agent_id", "agent_name",
    "icd_code", "diagnosis_name", "severity", "chronic",
    "provider_id", "provider_name", "medication", "treatment_type", "treatment_cost",
    "claim_id", "claim_amount", "claim_status", "denial_reason",
    "confidence_score",
  ];

  for (const field of textFields) {
    const val = get(field);
    if (val) (row as unknown as Record<string, string>)[field] = val;
  }

  return row;
}

function sanitizeTimestamp(ts: string): string {
  if (!ts) return new Date().toISOString();
  // "2025-06-01 15:30:00" → "2025-06-01T15:30:00"
  const cleaned = ts.replace(" ", "T");
  // Add Z if no timezone info
  if (cleaned.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/) || cleaned.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
    return cleaned + "Z";
  }
  return cleaned;
}

// ── Neo4j bulk write ──────────────────────────────────────────────────────────

async function bulkWriteNeo4j(
  rows: CanonicalRow[],
  tenantId: string,
  vertical: string
): Promise<{ ingested: number; failed: number }> {
  let ingested = 0;
  let failed = 0;

  const driver = getDriver();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    // Use a fresh session per batch; run each UNWIND as an independent auto-commit query
    // (executeWrite with multiple async tx.run() calls is unreliable in neo4j-driver v6)
    const neo4jSession = driver.session();
    try {
      if (vertical === "retail") {
        // 1. Profiles + Events
        await neo4jSession.run(`
          UNWIND $rows AS row
          MERGE (p:Profile {profile_id: row.profile_id, _tenant: $tenant})
            ON CREATE SET
              p.name = row.name, p.email = row.email, p.phone = row.phone,
              p.tier = row.tier, p.city = row.city,
              p.ltv = toFloat(coalesce(row.ltv, '0'))
            ON MATCH SET
              p.tier = coalesce(row.tier, p.tier),
              p.city = coalesce(row.city, p.city)
          CREATE (e:Event {
            id: row.event_id,
            event_type: coalesce(row.event_type, 'unknown'),
            timestamp: datetime(row.timestamp),
            amount: toFloat(coalesce(row.amount, '0')),
            channel: row.channel,
            status: coalesce(row.status, 'completed'),
            confidence_score: toFloat(coalesce(row.confidence_score, '1.0')),
            _tenant: $tenant,
            created_at: datetime()
          })
          CREATE (p)-[:PERFORMED]->(e)
        `, { rows: batch, tenant: tenantId });

        // 2. Products
        await neo4jSession.run(`
          UNWIND $rows AS row
          WITH row WHERE row.product_id IS NOT NULL AND row.product_id <> ''
          MATCH (e:Event {id: row.event_id, _tenant: $tenant})
          MERGE (prod:Product {product_id: row.product_id, _tenant: $tenant})
            ON CREATE SET
              prod.name = row.product_name, prod.brand = row.brand,
              prod.category = row.category,
              prod.price = toFloat(coalesce(row.price, '0'))
          MERGE (e)-[:INVOLVES]->(prod)
        `, { rows: batch, tenant: tenantId });

        // 3. Agents
        await neo4jSession.run(`
          UNWIND $rows AS row
          WITH row WHERE row.agent_id IS NOT NULL AND row.agent_id <> ''
          MATCH (e:Event {id: row.event_id, _tenant: $tenant})
          MERGE (a:Agent {agent_id: row.agent_id, _tenant: $tenant})
            ON CREATE SET a.name = row.agent_name
          MERGE (e)-[:HANDLED_BY]->(a)
        `, { rows: batch, tenant: tenantId });

      } else {
        // Healthcare

        // 1. Profiles + Visits
        await neo4jSession.run(`
          UNWIND $rows AS row
          MERGE (p:Profile {profile_id: row.profile_id, _tenant: $tenant})
            ON CREATE SET
              p.name = row.name, p.email = row.email, p.phone = row.phone,
              p.age = toInteger(coalesce(row.age, '0')),
              p.gender = row.gender, p.city = row.city,
              p.insurance_provider = row.insurance_provider
            ON MATCH SET
              p.insurance_provider = coalesce(row.insurance_provider, p.insurance_provider)
          CREATE (v:Visit {
            visit_id: row.event_id,
            type: coalesce(row.type, 'Outpatient'),
            timestamp: datetime(row.timestamp),
            department: row.department,
            status: coalesce(row.status, 'Discharged'),
            priority: coalesce(row.priority, 'Medium'),
            duration_hours: toFloat(coalesce(row.duration_hours, '0')),
            confidence_score: toFloat(coalesce(row.confidence_score, '1.0')),
            _tenant: $tenant,
            created_at: datetime()
          })
          CREATE (p)-[:HAD_VISIT]->(v)
        `, { rows: batch, tenant: tenantId });

        // 2. Diagnoses
        await neo4jSession.run(`
          UNWIND $rows AS row
          WITH row WHERE row.diagnosis_name IS NOT NULL AND row.diagnosis_name <> ''
          MATCH (v:Visit {visit_id: row.event_id, _tenant: $tenant})
          MERGE (d:Diagnosis {name: row.diagnosis_name, _tenant: $tenant})
            ON CREATE SET
              d.icd_code = row.icd_code, d.severity = row.severity,
              d.chronic = (row.chronic = 'true')
          MERGE (v)-[:DIAGNOSED_WITH]->(d)
        `, { rows: batch, tenant: tenantId });

        // 3. Providers
        await neo4jSession.run(`
          UNWIND $rows AS row
          WITH row WHERE row.provider_id IS NOT NULL AND row.provider_id <> ''
          MATCH (v:Visit {visit_id: row.event_id, _tenant: $tenant})
          MERGE (prov:Provider {provider_id: row.provider_id, _tenant: $tenant})
            ON CREATE SET prov.name = row.provider_name
          MERGE (v)-[:ATTENDED_BY]->(prov)
        `, { rows: batch, tenant: tenantId });

        // 4. Insurance claims
        await neo4jSession.run(`
          UNWIND $rows AS row
          WITH row WHERE row.claim_id IS NOT NULL AND row.claim_id <> ''
          MATCH (v:Visit {visit_id: row.event_id, _tenant: $tenant})
          MERGE (ic:InsuranceClaim {claim_id: row.claim_id, _tenant: $tenant})
            ON CREATE SET
              ic.amount = toFloat(coalesce(row.claim_amount, '0')),
              ic.status = coalesce(row.claim_status, 'Pending'),
              ic.denial_reason = row.denial_reason
          MERGE (v)-[:CLAIMED_VIA]->(ic)
        `, { rows: batch, tenant: tenantId });
      }

      ingested += batch.length;
    } catch (e) {
      console.error(`[CSV ingest] Batch ${batchNum} failed:`, e instanceof Error ? e.message : e);
      failed += batch.length;
    } finally {
      await neo4jSession.close();
    }
  }

  return { ingested, failed };
}

// ── CSV parser (handles quoted fields) ───────────────────────────────────────

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
