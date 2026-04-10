/**
 * raw-mapper.ts — Maps any client JSON payload to ContextMesh event schema.
 *
 * Strategy:
 * 1. Try client-specific config fields first
 * 2. Fall back to common field names
 * 3. If still not found, store entire payload in properties
 */

import { IngestConfig, DEFAULT_CONFIG } from "./ingest-configs";

// Common field name aliases to try when config field is missing
const IDENTIFIER_ALIASES = ["email", "user_id", "phone", "customer_id", "patient_id", "mrn", "uid", "userId", "user", "account_id"];
const EVENT_TYPE_ALIASES = ["event_type", "event", "action", "type", "name", "event_name", "eventType"];
const TIMESTAMP_ALIASES = ["timestamp", "created_at", "ts", "date", "time", "event_time", "occurred_at", "occurredAt", "datetime"];
const AMOUNT_ALIASES = ["amount", "price", "total", "value", "order_value", "transaction_amount", "selling_price", "cost", "bill_amount"];
const CHANNEL_ALIASES = ["channel", "platform", "source", "medium", "device"];

function tryFields(payload: Record<string, unknown>, fields: string[]): unknown {
  for (const field of fields) {
    if (payload[field] !== undefined && payload[field] !== null && payload[field] !== "") {
      return payload[field];
    }
  }
  return undefined;
}

function extractIdentifiers(payload: Record<string, unknown>, config: IngestConfig): Record<string, string> {
  const identifiers: Record<string, string> = {};
  const fieldsToTry = [...(config.identifier_fields || []), ...IDENTIFIER_ALIASES];

  for (const field of fieldsToTry) {
    const val = payload[field];
    if (val && typeof val === "string" && val.length > 0) {
      // Map to known identifier types
      if (field.includes("email") || val.includes("@")) {
        identifiers.email = val;
      } else if (field.includes("phone") || field.includes("mobile")) {
        identifiers.phone = val;
      } else if (field.includes("mrn") || field.includes("patient_id")) {
        identifiers.mrn = val;
      } else if (field.includes("aadhaar")) {
        identifiers.aadhaar = val;
      } else {
        // Generic — use as crm_id or user_id
        identifiers[field.includes("user") ? "user_id" : "crm_id"] = val;
      }
    }
  }

  return identifiers;
}

function extractEventType(payload: Record<string, unknown>, config: IngestConfig): string {
  const fields = [config.event_type_field, ...EVENT_TYPE_ALIASES].filter(Boolean) as string[];
  const raw = tryFields(payload, fields);
  if (!raw) return "custom_event";

  const rawStr = String(raw).toLowerCase().trim();

  // Apply event type map if configured
  const mapped = config.event_type_map?.[rawStr] || config.event_type_map?.[String(raw)];
  if (mapped) return mapped;

  // Normalize common event names
  const normalizations: Record<string, string> = {
    "purchase": "purchase", "buy": "purchase", "order": "purchase", "sold": "purchase",
    "return": "return_initiated", "refund": "refund_issued",
    "view": "product_view", "click": "product_view",
    "cart": "add_to_cart", "add": "add_to_cart",
    "support": "support_ticket", "ticket": "support_ticket",
    "delivery": "delivery_completed", "delivered": "delivery_completed",
    "visit": "visit", "admission": "visit", "discharge": "visit",
    "login": "page_view", "session": "page_view",
  };

  for (const [key, val] of Object.entries(normalizations)) {
    if (rawStr.includes(key)) return val;
  }

  return rawStr.replace(/[^a-z0-9_]/g, "_");
}

export interface MappedEvent {
  event_type: string;
  identifiers: Record<string, string>;
  profile_data: Record<string, unknown>;
  timestamp?: string;
  amount?: number;
  channel?: string;
  confidence_score: number;
  source: string;
  source_id?: string;
  properties: Record<string, unknown>;
  product?: Record<string, unknown>;
  provider?: Record<string, unknown>;
  diagnosis?: Record<string, unknown>;
}

export function mapRawPayload(
  payload: Record<string, unknown>,
  config: IngestConfig = DEFAULT_CONFIG,
  source: string = "raw"
): MappedEvent | null {
  // Extract identifiers — at least one required
  const identifiers = extractIdentifiers(payload, config);
  if (Object.keys(identifiers).length === 0) return null;

  // Extract event type
  const event_type = extractEventType(payload, config);

  // Extract timestamp
  const tsFields = [config.timestamp_field, ...TIMESTAMP_ALIASES].filter(Boolean) as string[];
  const rawTs = tryFields(payload, tsFields);
  let timestamp: string | undefined;
  if (rawTs) {
    try {
      timestamp = new Date(String(rawTs)).toISOString();
    } catch {
      timestamp = new Date().toISOString();
    }
  }

  // Extract amount
  const amtFields = [config.amount_field, ...AMOUNT_ALIASES].filter(Boolean) as string[];
  const rawAmt = tryFields(payload, amtFields);
  const amount = rawAmt ? parseFloat(String(rawAmt)) : undefined;

  // Extract channel
  const chFields = [config.channel_field, ...CHANNEL_ALIASES].filter(Boolean) as string[];
  const channel = String(tryFields(payload, chFields) || "api");

  // Extract product fields (retail)
  let product: Record<string, unknown> | undefined;
  if (config.product_fields) {
    const pf = config.product_fields;
    const pName = pf.name ? payload[pf.name] : tryFields(payload, ["product_name", "item_name", "product", "item"]);
    if (pName) {
      product = {
        name: pName,
        brand: pf.brand ? payload[pf.brand] : tryFields(payload, ["brand", "brand_name"]),
        category: pf.category ? payload[pf.category] : tryFields(payload, ["category", "department"]),
        price: pf.price ? payload[pf.price] : amount,
        product_id: pf.id ? payload[pf.id] : tryFields(payload, ["product_id", "item_id", "sku"]),
      };
    }
  }

  // Extract provider fields (healthcare)
  let provider: Record<string, unknown> | undefined;
  if (config.provider_fields) {
    const pf = config.provider_fields;
    const pName = pf.name ? payload[pf.name] : tryFields(payload, ["doctor_name", "doctor", "provider_name", "physician"]);
    if (pName) {
      provider = {
        name: pName,
        provider_id: pf.id ? payload[pf.id] : tryFields(payload, ["doctor_id", "provider_id"]),
        specialization: pf.specialization ? payload[pf.specialization] : tryFields(payload, ["specialty", "specialization"]),
        department: pf.department ? payload[pf.department] : tryFields(payload, ["department", "dept"]),
      };
    }
  }

  // Extract diagnosis fields (healthcare)
  let diagnosis: Record<string, unknown> | undefined;
  if (config.diagnosis_fields) {
    const df = config.diagnosis_fields;
    const dName = df.name ? payload[df.name] : tryFields(payload, ["diagnosis", "condition", "disease"]);
    if (dName) {
      diagnosis = {
        name: dName,
        icd_code: df.icd_code ? payload[df.icd_code] : tryFields(payload, ["icd_code", "icd", "diagnosis_code"]),
        severity: df.severity ? payload[df.severity] : tryFields(payload, ["severity", "priority"]),
      };
    }
  }

  // Profile data (name, city, tier etc.)
  const profile_data: Record<string, unknown> = {};
  const nameVal = tryFields(payload, ["name", "full_name", "customer_name", "patient_name", "user_name"]);
  if (nameVal) profile_data.name = nameVal;
  const cityVal = tryFields(payload, ["city", "location", "region", "state"]);
  if (cityVal) profile_data.city = cityVal;
  const tierVal = tryFields(payload, ["tier", "membership", "plan", "segment", "loyalty_tier"]);
  if (tierVal) profile_data.tier = tierVal;
  const ageVal = tryFields(payload, ["age", "patient_age"]);
  if (ageVal) profile_data.age = ageVal;
  const genderVal = tryFields(payload, ["gender", "sex"]);
  if (genderVal) profile_data.gender = genderVal;

  // Source ID for idempotency
  const source_id = String(
    tryFields(payload, ["id", "event_id", "order_id", "ticket_id", "visit_id", "transaction_id"]) || ""
  ) || undefined;

  // Confidence: higher if we found identifier + event_type from config fields
  const confidence = Object.keys(identifiers).length > 0 ? 0.85 : 0.6;

  return {
    event_type,
    identifiers,
    profile_data,
    timestamp,
    amount: isNaN(amount as number) ? undefined : amount,
    channel,
    confidence_score: confidence,
    source,
    source_id,
    properties: payload, // store full original payload
    product,
    provider,
    diagnosis,
  };
}
