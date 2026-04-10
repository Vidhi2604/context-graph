/**
 * Client mapping configs — one per client/vertical.
 * Add a new entry here to support any data format without changing client code.
 */

export interface IngestConfig {
  // Fields to try as identifiers (in priority order)
  identifier_fields: string[];

  // Field that contains the event type
  event_type_field?: string;

  // Field that contains the timestamp
  timestamp_field?: string;

  // Field that contains the transaction amount
  amount_field?: string;

  // Field that contains the channel (web/app/mobile)
  channel_field?: string;

  // Map client event names → ContextMesh event types
  event_type_map?: Record<string, string>;

  // Product field mappings
  product_fields?: {
    name?: string;
    brand?: string;
    category?: string;
    price?: string;
    id?: string;
  };

  // Provider/agent field mappings (healthcare)
  provider_fields?: {
    name?: string;
    id?: string;
    specialization?: string;
    department?: string;
  };

  // Diagnosis field mappings (healthcare)
  diagnosis_fields?: {
    name?: string;
    icd_code?: string;
    severity?: string;
  };
}

// ── Client configs ─────────────────────────────────────────────────────────

const configs: Record<string, IngestConfig> = {
  // Myntra / e-commerce style
  myntra: {
    identifier_fields: ["customer_email", "user_id", "customer_id", "phone", "mobile"],
    event_type_field: "event_name",
    timestamp_field: "created_at",
    amount_field: "order_value",
    channel_field: "platform",
    event_type_map: {
      "order_placed": "purchase",
      "order_confirmed": "purchase",
      "item_returned": "return_initiated",
      "return_requested": "return_initiated",
      "refund_processed": "refund_issued",
      "add_to_basket": "add_to_cart",
      "add_to_wishlist": "product_view",
      "payment_success": "purchase",
      "delivery_done": "delivery_completed",
      "support_raised": "support_ticket",
    },
    product_fields: { name: "item_name", brand: "brand_name", category: "category", price: "selling_price", id: "product_id" },
  },

  // Flipkart style
  flipkart: {
    identifier_fields: ["email_id", "account_id", "mobile_number"],
    event_type_field: "action",
    timestamp_field: "event_time",
    amount_field: "transaction_amount",
    channel_field: "source",
    event_type_map: {
      "PURCHASE": "purchase",
      "RETURN": "return_initiated",
      "CART_ADD": "add_to_cart",
      "REFUND": "refund_issued",
      "VIEW_PRODUCT": "product_view",
      "DELIVERY": "delivery_completed",
    },
    product_fields: { name: "product_title", brand: "seller_brand", price: "transaction_amount", id: "listing_id" },
  },

  // Care Hospitals / healthcare style
  care_hospitals: {
    identifier_fields: ["patient_id", "mrn", "aadhaar", "phone", "email"],
    event_type_field: "event_type",
    timestamp_field: "visit_date",
    amount_field: "bill_amount",
    event_type_map: {
      "OPD_VISIT": "visit",
      "IPD_ADMISSION": "visit",
      "DISCHARGE": "visit",
      "EMERGENCY": "visit",
      "SURGERY": "visit",
    },
    provider_fields: { name: "doctor_name", id: "doctor_id", specialization: "specialty", department: "department" },
    diagnosis_fields: { name: "diagnosis", icd_code: "icd_code", severity: "severity" },
  },

  // Generic Zendesk webhook style
  zendesk: {
    identifier_fields: ["requester_email", "requester_id", "email"],
    event_type_field: "type",
    timestamp_field: "created_at",
    event_type_map: {
      "ticket.created": "support_ticket",
      "ticket.solved": "ticket_resolved",
      "ticket.updated": "support_ticket",
    },
  },

  // Generic HubSpot webhook style
  hubspot: {
    identifier_fields: ["email", "hs_email_address", "phone"],
    event_type_field: "subscriptionType",
    timestamp_field: "occurredAt",
    event_type_map: {
      "contact.creation": "contact_updated",
      "contact.propertyChange": "contact_updated",
      "deal.creation": "deal_stage_changed",
      "deal.propertyChange": "deal_stage_changed",
    },
  },
};

// ── Default fallback config (used when no client-specific config found) ─────

export const DEFAULT_CONFIG: IngestConfig = {
  identifier_fields: ["email", "user_id", "phone", "customer_id", "patient_id", "mrn", "id", "uid", "userId"],
  event_type_field: "event_type",   // tries: event_type, event, action, type, name
  timestamp_field: "timestamp",     // tries: timestamp, created_at, ts, date, time
  amount_field: "amount",           // tries: amount, price, total, value, order_value
  channel_field: "channel",         // tries: channel, platform, source, medium
  event_type_map: {},
};

export function getConfig(clientKey?: string): IngestConfig {
  if (!clientKey) return DEFAULT_CONFIG;
  return configs[clientKey.toLowerCase()] || DEFAULT_CONFIG;
}

export function getClientKeys(): string[] {
  return Object.keys(configs);
}
