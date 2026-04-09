import { z } from "zod";

// ---- Shared schemas ----

export const IdentifiersSchema = z.record(z.string(), z.string()).refine(
  (obj) => Object.keys(obj).length > 0,
  { message: "At least one identifier required" }
);

export const ProfileDataSchema = z.record(z.string(), z.unknown()).optional();

// ---- Retail Event Schema ----

export const RetailEventSchema = z.object({
  event_type: z.string().min(1),
  identifiers: IdentifiersSchema,
  profile_data: ProfileDataSchema,
  timestamp: z.string().datetime().optional(),
  status: z.string().optional(),
  amount: z.number().optional(),
  channel: z.string().optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  product: z.object({
    product_id: z.string().optional(),
    name: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    price: z.number().optional(),
  }).optional(),
  payment: z.object({
    method: z.string().optional(),
    amount: z.number().optional(),
    status: z.string().optional(),
  }).optional(),
  agent: z.object({
    agent_id: z.string().optional(),
    name: z.string().optional(),
    role: z.string().optional(),
    action: z.string().optional(),
  }).optional(),
  policy: z.object({
    policy_id: z.string().optional(),
    name: z.string().optional(),
    version: z.string().optional(),
    exception: z.boolean().optional(),
  }).optional(),
});

// ---- Healthcare Event Schema ----

export const HealthcareEventSchema = z.object({
  event_type: z.string().min(1),
  identifiers: IdentifiersSchema,
  profile_data: ProfileDataSchema,
  timestamp: z.string().datetime().optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  visit: z.object({
    visit_id: z.string().optional(),
    type: z.string().optional(),
    department: z.string().optional(),
    priority: z.string().optional(),
    duration_hours: z.number().optional(),
  }).optional(),
  diagnosis: z.object({
    diagnosis_id: z.string().optional(),
    icd_code: z.string().optional(),
    name: z.string().optional(),
    severity: z.string().optional(),
    chronic: z.boolean().optional(),
  }).optional(),
  treatment: z.object({
    treatment_id: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    cost: z.number().optional(),
    duration_hours: z.number().optional(),
  }).optional(),
  provider: z.object({
    provider_id: z.string().optional(),
    name: z.string().optional(),
    specialization: z.string().optional(),
    department: z.string().optional(),
  }).optional(),
  medications: z.array(z.object({
    medication_id: z.string().optional(),
    name: z.string().optional(),
    dosage: z.string().optional(),
    frequency: z.string().optional(),
    duration_days: z.number().optional(),
  })).optional(),
  insurance_claim: z.object({
    claim_id: z.string().optional(),
    amount: z.number().optional(),
    status: z.string().optional(),
    denial_reason: z.string().optional(),
    payer: z.string().optional(),
  }).optional(),
  protocol: z.object({
    protocol_id: z.string().optional(),
    name: z.string().optional(),
    version: z.string().optional(),
    deviation: z.boolean().optional(),
  }).optional(),
});

// ---- Batch Schema ----

export const BatchEventsSchema = z.object({
  events: z.array(z.union([RetailEventSchema, HealthcareEventSchema])).min(1).max(1000),
});

// ---- Transcript Schema ----

export const TranscriptSchema = z.object({
  source: z.string().default("voice_stt"),
  call_id: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  duration_seconds: z.number().optional(),
  participants: z.array(z.object({
    role: z.string(),
    name: z.string().optional(),
    phone: z.string().optional(),
    agent_id: z.string().optional(),
  })).optional(),
  transcript: z.array(z.object({
    speaker: z.string(),
    text: z.string(),
    start: z.number().optional(),
  })).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ---- Search Schema ----

export const SearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(200).default(50),
  time_range: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
});

// ---- TypeScript types ----

export type RetailEvent = z.infer<typeof RetailEventSchema>;
export type HealthcareEvent = z.infer<typeof HealthcareEventSchema>;
export type TranscriptInput = z.infer<typeof TranscriptSchema>;
export type SearchInput = z.infer<typeof SearchSchema>;

export const RETAIL_EVENT_TYPES = [
  "app_install", "page_view", "product_view", "search", "add_to_cart",
  "remove_from_cart", "begin_checkout", "add_payment_info", "purchase",
  "delivery_scheduled", "delivery_completed", "return_initiated",
  "return_completed", "refund_issued", "support_ticket", "review_submitted",
] as const;

export const HEALTHCARE_EVENT_TYPES = [
  "visit", "diagnosis", "treatment", "medication_prescribed", "discharge",
  "readmission", "follow_up", "surgery", "lab_result", "referral",
  "insurance_claim", "support_call",
] as const;
