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

  for (const field of fieldsToTry) {
    const val = payload[field];
    if (val && typeof val === "string" && val.length > 0) {
      // Map to known identifier types
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
    const pName = pf.name ? payload[pf.name] : tryFields(payload, [
      "doctor_name", "doctor", "provider_name", "physician", "doc",
      "doctor_assigned", "specialist", "surgeon", "assigned_to",
      "attending", "treating_dr", "treating_physician", "physician_name",
    ]);
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
  const nameVal = tryFields(payload, [
    "name", "full_name", "customer_name", "patient_name", "user_name",
    "patient_nm", "nm", "pt_name", "person_name", "account_holder",
    "buyer", "client_name", "consumer_name", "subject", "username",
    "user_full_name",
  ]);
  if (nameVal) profile_data.name = nameVal;
  const cityVal = tryFields(payload, ["city", "location", "region", "state", "area", "loc", "buyer_city", "client_city", "pincode"]);
  if (cityVal) profile_data.city = cityVal;
  const tierVal = tryFields(payload, ["tier", "membership", "plan", "segment", "loyalty_tier"]);
  if (tierVal) profile_data.tier = tierVal;
  const ageVal = tryFields(payload, ["age", "patient_age"]);
  if (ageVal) profile_data.age = ageVal;
  const genderVal = tryFields(payload, ["gender", "sex"]);
  if (genderVal) profile_data.gender = genderVal;

  // Auto-extract visit context for healthcare-like payloads
  const visitDept = tryFields(payload, ["dept", "department", "ward", "ward_no", "discharge_ward", "dept_code"]);
  const visitPriority = tryFields(payload, ["priority", "priority_level", "urgency", "severity"]);
  const visitType = tryFields(payload, ["visit_type", "case_type", "admission", "appointment_type", "service_type", "event_kind", "consultation"]);
  if (visitDept || visitPriority || visitType) {
    (provider as Record<string, unknown> | undefined) = provider || {};
    // Store visit metadata in properties for process route to use
    (payload as Record<string, unknown>)._visit_dept = visitDept;
    (payload as Record<string, unknown>)._visit_priority = visitPriority;
    (payload as Record<string, unknown>)._visit_type = visitType;
  }

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
