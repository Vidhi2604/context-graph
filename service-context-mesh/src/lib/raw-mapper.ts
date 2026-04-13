/**
 * raw-mapper.ts — Maps any client JSON payload to ContextMesh event schema.
 *
 * Strategy:
 * 1. Try client-specific config fields first
 * 2. Fall back to common field names
 * 3. If still not found, store entire payload in properties
 */

import { IngestConfig, DEFAULT_CONFIG } from "./ingest-configs";

/**
 * Recursively flattens a nested object into dot-notation keys AND
 * also keeps all leaf values accessible at the top level with their last key segment.
 * e.g. { product: { name: "X", specs: { color: "red" } } }
 * → { "product.name": "X", "product.specs.color": "red", "product_name": "X", "color": "red" }
 * This lets any field at any nesting depth be found by the mapper.
 */
function flattenPayload(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const dotKey = prefix ? `${prefix}.${key}` : key;
    const flatKey = prefix ? `${prefix}_${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const nested = flattenPayload(val as Record<string, unknown>, dotKey);
      Object.assign(result, nested);
      // Also add underscore-joined version
      const nestedFlat = flattenPayload(val as Record<string, unknown>, flatKey);
      Object.assign(result, nestedFlat);
      // Keep the last segment accessible directly (e.g. "name" from "product.name")
      result[key] = result[key] ?? val; // don't overwrite if already at top level
    } else {
      result[dotKey] = val;
      result[flatKey] = val;
      result[key] = result[key] ?? val; // keep shorter key if not already set
    }
  }
  return result;
}

// Common field name aliases to try when config field is missing
const IDENTIFIER_ALIASES = [
  // email
  "email", "email_id", "mail",
  // phone
  "phone", "phone_no", "phone_number", "mobile", "mobile_no", "mob",
  "contact", "contact_no", "contact_number", "whatsapp", "cell", "ph",
  "patient_phone", "pt_phone", "buyer_phone", "client_phone", "consumer_phone",
  // user IDs
  "user_id", "uid", "userId", "user", "cust_id", "customer_id",
  "patient_id", "pat_id", "pt_id", "account_id", "account",
  "ref_id", "ref", "record_no", "reg_no", "hospital_id", "serial",
  "token", "case_id", "entry_id", "record_id",
  // mrn
  "mrn", "medical_record_no",
];
const EVENT_TYPE_ALIASES = [
  "event_type", "event", "action", "action_type", "type", "event_name", "eventType",
  "visit_type", "case_type", "appointment_type", "service_type", "event_kind",
  "transaction_type", "txn", "purchase_type", "order_action", "activity",
  "admission", "consultation", "service", "reason",
];
const TIMESTAMP_ALIASES = [
  "timestamp", "created_at", "ts", "date", "time", "event_time", "occurred_at",
  "occurredAt", "datetime", "dt", "visit_date", "admit_date", "event_date",
  "surgery_date", "logged", "appt_date", "readmit_ts", "discharge_date",
  "purchase_ts", "sale_date", "order_date", "entry_time", "admitted",
];
const AMOUNT_ALIASES = [
  "amount", "price", "total", "value", "order_value", "transaction_amount",
  "selling_price", "cost", "bill_amount", "sale_price", "purchase_amt",
  "return_amount", "amt", "fee",
];
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

  // First pass: check known alias fields
  for (const field of fieldsToTry) {
    const val = payload[field];
    if (val && typeof val === "string" && val.length > 0) {
      const isPhone = ["phone","mobile","mob","contact","whatsapp","cell","ph"].some(k => field.includes(k))
        || /^[\d\s\-\+\(\)]{8,15}$/.test(val.replace(/[^\d]/g, "").length >= 8 ? val : "");
      if (field.includes("email") || val.includes("@")) {
        identifiers.email = val;
      } else if (isPhone) {
        identifiers.phone = val;
      } else if (field.includes("mrn") || field.includes("patient_id") || field.includes("pat_id")) {
        identifiers.mrn = val;
      } else if (field.includes("aadhaar")) {
        identifiers.aadhaar = val;
      } else {
        identifiers[field.includes("user") ? "user_id" : "crm_id"] = val;
      }
    }
  }

  // Second pass: scan ALL payload keys for email/phone patterns (handles customer_email, buyer_phone, etc.)
  if (Object.keys(identifiers).length === 0) {
    for (const [field, val] of Object.entries(payload)) {
      if (!val || typeof val !== "string") continue;
      if (field.includes("email") || val.includes("@")) {
        identifiers.email = val; break;
      }
    }
    for (const [field, val] of Object.entries(payload)) {
      if (!val || typeof val !== "string") continue;
      if (["phone","mobile","mob","cell","contact","whatsapp"].some(k => field.toLowerCase().includes(k))) {
        identifiers.phone = val; break;
      }
    }
    for (const [field, val] of Object.entries(payload)) {
      if (!val || typeof val !== "string") continue;
      if (field.toLowerCase().includes("user_id") || field.toLowerCase().includes("customer_id") || field.toLowerCase().includes("uid")) {
        identifiers.user_id = val; break;
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
    // Retail
    "purchase": "purchase", "buy": "purchase", "order": "purchase", "sold": "purchase",
    "sale": "purchase", "cod": "purchase",
    "return": "return_initiated", "refund": "refund_issued", "return_request": "return_initiated",
    "view": "product_view", "click": "product_view",
    "cart": "add_to_cart", "add_to_basket": "add_to_cart", "basket": "add_to_cart",
    "support": "support_ticket", "ticket": "support_ticket", "complaint": "support_ticket",
    "support_call": "support_ticket",
    "delivery": "delivery_completed", "delivered": "delivery_completed",
    "cancel": "order_cancelled", "cancelled": "order_cancelled",
    "login": "page_view", "session": "page_view",
    // Healthcare
    "emergency": "visit", "admission": "visit", "admitted": "visit",
    "inpatient": "visit", "outpatient": "visit", "follow_up": "visit",
    "follow-up": "visit", "followup": "visit", "consultation": "visit",
    "surgery": "visit", "procedure": "visit", "discharge": "visit",
    "readmission": "visit", "readmit": "visit",
    "diagnosis": "visit", "checkup": "visit", "appointment": "visit",
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
  policy?: Record<string, unknown>;
  agent?: Record<string, unknown>;
  payment?: Record<string, unknown>;
}

export function mapRawPayload(
  payload: Record<string, unknown>,
  config: IngestConfig = DEFAULT_CONFIG,
  source: string = "raw"
): MappedEvent | null {
  // Flatten nested payload so any field at any depth is accessible
  const flat = { ...flattenPayload(payload), ...payload };

  // Extract identifiers — at least one required
  const identifiers = extractIdentifiers(flat, config);
  if (Object.keys(identifiers).length === 0) return null;

  // Extract event type
  const event_type = extractEventType(flat, config);

  // Extract timestamp
  const tsFields = [config.timestamp_field, ...TIMESTAMP_ALIASES].filter(Boolean) as string[];
  const rawTs = tryFields(flat, tsFields);
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
  const rawAmt = tryFields(flat, amtFields);
  const amount = rawAmt ? parseFloat(String(rawAmt)) : undefined;

  // Extract channel
  const chFields = [config.channel_field, ...CHANNEL_ALIASES].filter(Boolean) as string[];
  const channel = String(tryFields(flat, chFields) || "api");

  // Extract product fields (retail) — also checks nested product object
  let product: Record<string, unknown> | undefined;
  const nestedProduct = typeof flat.product === "object" && payload.product !== null
    ? flat.product as Record<string, unknown>
    : null;
  if (config.product_fields) {
    const pf = config.product_fields;
    const pName = pf.name ? flat[pf.name]
      : tryFields(flat, ["product_name", "item_name"])
      || nestedProduct?.name;
    if (pName) {
      product = {
        name: pName,
        brand: pf.brand ? flat[pf.brand] : tryFields(flat, ["brand", "brand_name"]) || nestedProduct?.brand,
        category: pf.category ? flat[pf.category] : tryFields(flat, ["category", "department"]) || nestedProduct?.category,
        price: pf.price ? flat[pf.price] : amount,
        product_id: pf.id ? flat[pf.id] : tryFields(flat, ["product_id", "item_id", "sku"]) || nestedProduct?.id,
      };
    }
  } else if (nestedProduct?.name) {
    // No config but nested product object present — use it directly
    product = {
      name: nestedProduct.name,
      category: nestedProduct.category,
      product_id: nestedProduct.id || nestedProduct.product_id,
      price: amount,
    };
  }

  // Extract provider fields (healthcare)
  let provider: Record<string, unknown> | undefined;
  if (config.provider_fields) {
    const pf = config.provider_fields;
    const pName = pf.name ? flat[pf.name] : tryFields(flat, [
      "doctor_name", "doctor", "provider_name", "physician", "doc",
      "doctor_assigned", "specialist", "surgeon", "assigned_to",
      "attending", "treating_dr", "treating_physician", "physician_name",
    ]);
    if (pName) {
      provider = {
        name: pName,
        provider_id: pf.id ? flat[pf.id] : tryFields(flat, ["doctor_id", "provider_id"]),
        specialization: pf.specialization ? flat[pf.specialization] : tryFields(flat, ["specialty", "specialization"]),
        department: pf.department ? flat[pf.department] : tryFields(flat, ["department", "dept"]),
      };
    }
  }

  // Extract diagnosis fields (healthcare)
  let diagnosis: Record<string, unknown> | undefined;
  if (config.diagnosis_fields) {
    const df = config.diagnosis_fields;
    const dName = df.name ? flat[df.name] : tryFields(flat, ["diagnosis", "condition", "disease"]);
    if (dName) {
      diagnosis = {
        name: dName,
        icd_code: df.icd_code ? flat[df.icd_code] : tryFields(flat, ["icd_code", "icd", "diagnosis_code"]),
        severity: df.severity ? flat[df.severity] : tryFields(flat, ["severity", "priority"]),
      };
    }
  }

  // Profile data (name, city, tier etc.)
  const profile_data: Record<string, unknown> = {};
  const nameVal = tryFields(flat, [
    "name", "full_name", "customer_name", "patient_name", "user_name",
    "patient_nm", "nm", "pt_name", "person_name", "account_holder",
    "buyer", "client_name", "consumer_name", "subject", "username",
    "user_full_name",
  ]);
  if (nameVal) profile_data.name = nameVal;
  const cityVal = tryFields(flat, ["city", "location", "region", "state", "area", "loc", "buyer_city", "client_city", "pincode"]);
  if (cityVal) profile_data.city = cityVal;
  const tierVal = tryFields(flat, ["tier", "membership", "plan", "segment", "loyalty_tier"]);
  if (tierVal) profile_data.tier = tierVal;
  const ageVal = tryFields(flat, ["age", "patient_age"]);
  if (ageVal) profile_data.age = ageVal;
  const genderVal = tryFields(flat, ["gender", "sex"]);
  if (genderVal) profile_data.gender = genderVal;

  // Auto-extract visit context for healthcare-like payloads
  const visitDept = tryFields(flat, ["dept", "department", "ward", "ward_no", "discharge_ward", "dept_code"]);
  const visitPriority = tryFields(flat, ["priority", "priority_level", "urgency", "severity"]);
  const visitType = tryFields(flat, ["visit_type", "case_type", "admission", "appointment_type", "service_type", "event_kind", "consultation"]);
  if (visitDept || visitPriority || visitType) {
    (provider as Record<string, unknown> | undefined) = provider || {};
    // Store visit metadata in properties for process route to use
    (payload as Record<string, unknown>)._visit_dept = visitDept;
    (payload as Record<string, unknown>)._visit_priority = visitPriority;
    (payload as Record<string, unknown>)._visit_type = visitType;
  }

  // Source ID for idempotency
  const source_id = String(
    tryFields(flat, ["id", "event_id", "order_id", "ticket_id", "visit_id", "transaction_id"]) || ""
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
    policy: (payload.policy || payload.protocol) as Record<string, unknown> | undefined,
    agent: payload.agent as Record<string, unknown> | undefined,
    payment: (payload.payment as Record<string, unknown>) ||
      (payload.payment_method ? { method: payload.payment_method } : undefined),
  };
}
