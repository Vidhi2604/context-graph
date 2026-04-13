/**
 * payload-normalizer.ts
 *
 * Normalizes ANY incoming JSON shape into a flat array of event-like objects
 * before the raw-mapper processes them.
 *
 * Handles:
 * - Single object: { email, event_type, ... }
 * - Array of objects: [{ email, event_type }, ...]
 * - Wrapped array: { data: [...] } or { customers: [...] } or { events: [...] }
 * - Nested events: customers[].transactions[] — parent fields inherited by each child
 * - Deeply nested identifiers: personal.contact.email → email
 * - Any sub-array key: transactions, events, orders, visits, interactions, history, records, items, calls, tickets
 */

// Keys that commonly wrap the main array
const ROOT_ARRAY_KEYS = [
  "data", "events", "records", "customers", "users", "patients",
  "contacts", "leads", "tickets", "orders", "calls", "interactions",
  "items", "results", "rows", "entries", "transactions", "visits",
  "profiles", "accounts", "sessions", "logs",
];

// Keys that indicate a sub-array of events within a parent record
const EVENT_ARRAY_KEYS = [
  "transactions", "events", "orders", "visits", "interactions",
  "history", "records", "tickets", "calls", "activities", "items",
  "purchases", "sessions", "logs", "timeline",
];

// Keys that hold identifier-like nested objects
const IDENTITY_CONTAINER_KEYS = [
  "personal", "contact", "contacts", "customer", "user", "profile",
  "identity", "info", "details", "data", "meta", "metadata",
];

// Keys that hold product/item info
const PRODUCT_CONTAINER_KEYS = [
  "item", "product", "goods", "merchandise", "sku_info", "product_info",
];

/**
 * Normalizes common field aliases to standard keys the mapper expects.
 * Mutates the object in place.
 */
function normalizeAliases(flat: Record<string, unknown>): void {
  if (!flat.event_type) {
    flat.event_type = flat.type || flat.event_kind || flat.action || flat.activity || flat.transaction_type;
  }
  if (!flat.timestamp) {
    flat.timestamp = flat.date || flat.occurred_at || flat.event_date || flat.created_at || flat.datetime;
  }
  if (!flat.amount) {
    flat.amount = flat.total_amount || flat.price || flat.order_value || flat.sale_price || flat.value;
  }
  if (!flat.status) {
    flat.status = flat.order_status || flat.state || flat.current_status;
  }
  if (!flat.channel) {
    flat.channel = flat.platform || flat.medium || flat.source || flat.device;
  }
  if (!flat.phone) {
    flat.phone = flat.mobile || flat.mobile_number || flat.contact_number || flat.cell;
  }
  if (!flat.email) {
    flat.email = flat.email_address || flat.mail || flat.email_id;
  }
  if (!flat.name) {
    flat.name = flat.full_name || flat.customer_name || flat.user_name || flat.display_name || flat.first_name;
  }
  if (!flat.product && (flat.item || flat.product_info || flat.goods)) {
    flat.product = flat.item || flat.product_info || flat.goods;
  }
  if (!flat.payment && (flat.payment_mode || flat.payment_info || flat.billing)) {
    flat.payment = flat.payment_mode || flat.payment_info || flat.billing;
  }
}

// Keys that hold payment info
const PAYMENT_CONTAINER_KEYS = [
  "payment", "payment_info", "billing", "transaction_info", "payment_details",
];

/**
 * Deeply flatten a nested object.
 * Surfaces EVERY leaf value under its short key name at the top level.
 * e.g. { personal: { contact: { email: "x" } } }
 *   → { email: "x", "contact.email": "x", "personal.contact.email": "x" }
 */
function deepFlatten(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const dotKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const nested = deepFlatten(val as Record<string, unknown>, dotKey);
      Object.assign(result, nested);
      // Also flatten with just the current key as prefix (shorter paths)
      const nestedShort = deepFlatten(val as Record<string, unknown>, key);
      for (const [k, v] of Object.entries(nestedShort)) {
        if (!(k in result)) result[k] = v;
      }
      if (!(key in result)) result[key] = val;
    } else if (!Array.isArray(val)) {
      result[dotKey] = val;
      // Always surface the leaf key at top level
      if (!(key in result)) result[key] = val;
    }
  }
  return result;
}

/**
 * Extract identifier fields from a nested object by checking common container keys.
 * Surfaces email, phone, name etc. from anywhere in the hierarchy.
 */
function surfaceIdentifiers(obj: Record<string, unknown>): Record<string, unknown> {
  const flat = deepFlatten(obj);
  const result: Record<string, unknown> = { ...flat };

  // Also check identity containers explicitly
  for (const containerKey of IDENTITY_CONTAINER_KEYS) {
    const container = obj[containerKey];
    if (container && typeof container === "object" && !Array.isArray(container)) {
      const containerFlat = deepFlatten(container as Record<string, unknown>);
      for (const [k, v] of Object.entries(containerFlat)) {
        if (!(k in result)) result[k] = v;
      }
    }
  }

  // Surface product container
  for (const containerKey of PRODUCT_CONTAINER_KEYS) {
    if (obj[containerKey] && typeof obj[containerKey] === "object") {
      if (!result.product) result.product = obj[containerKey];
    }
  }

  // Surface payment container
  for (const containerKey of PAYMENT_CONTAINER_KEYS) {
    if (obj[containerKey] && typeof obj[containerKey] === "object") {
      if (!result.payment) result.payment = obj[containerKey];
    }
  }

  return result;
}

/**
 * Given a single record that may contain a sub-array of events,
 * explode it into multiple flat event objects with parent fields inherited.
 */
function explodeRecord(record: Record<string, unknown>): Record<string, unknown>[] {
  // Find a sub-array of events
  for (const key of EVENT_ARRAY_KEYS) {
    const sub = record[key];
    if (Array.isArray(sub) && sub.length > 0) {
      // Parent fields (without the sub-array)
      const parent = { ...record };
      delete parent[key];
      const parentFlat = surfaceIdentifiers(parent);

      // Each sub-item inherits parent fields
      return sub.flatMap(item => {
        if (typeof item === "object" && item !== null) {
          const itemFlat = surfaceIdentifiers(item as Record<string, unknown>);
          // Parent fields fill in missing fields on child
          const merged: Record<string, unknown> = { ...parentFlat };
          for (const [k, v] of Object.entries(itemFlat)) {
            merged[k] = v; // child overrides parent
          }
          // Map common event-specific key aliases
          if (!merged.event_type && merged.type) merged.event_type = merged.type;
          if (!merged.timestamp && merged.date) merged.timestamp = merged.date;
          if (!merged.amount && merged.price) merged.amount = merged.price;
          if (!merged.product && merged.item) merged.product = merged.item;
          if (!merged.payment && merged.payment_info) merged.payment = merged.payment_info;
          if (!merged.phone && merged.mobile) merged.phone = merged.mobile;
          if (!merged.phone && merged.contact_number) merged.phone = merged.contact_number;
          if (!merged.product && (merged as Record<string,unknown>).sku) {
            merged.product = { id: merged.sku, name: merged.item_name || merged.sku };
          }
          normalizeAliases(merged);
          return [merged];
        }
        return [];
      });
    }
  }

  // No sub-array found — treat the record itself as one event
  const flat = surfaceIdentifiers(record);
  normalizeAliases(flat);
  return [flat];
}

/**
 * Main entry point.
 * Accepts ANY JSON value and returns a flat array of event-like objects
 * ready for raw-mapper processing.
 */
export function normalizePayload(input: unknown): Record<string, unknown>[] {
  // Handle null/undefined
  if (!input) return [];

  // If it's already a flat array of primitives/simple objects
  if (Array.isArray(input)) {
    return input.flatMap(item => {
      if (typeof item === "object" && item !== null) {
        return explodeRecord(item as Record<string, unknown>);
      }
      return [];
    });
  }

  if (typeof input !== "object") return [];

  const obj = input as Record<string, unknown>;

  // Check if it's a single event (has email/phone/user_id at top or one level down)
  const hasDirectIdentifier = ["email", "phone", "user_id", "customer_id", "mobile"].some(k => k in obj);
  const hasEventArrayKey = EVENT_ARRAY_KEYS.some(k => Array.isArray(obj[k]));

  if (hasDirectIdentifier && !hasEventArrayKey) {
    return explodeRecord(obj);
  }

  // Check for a wrapped root array: { customers: [...], data: [...] }
  for (const key of ROOT_ARRAY_KEYS) {
    const val = obj[key];
    if (Array.isArray(val) && val.length > 0) {
      return val.flatMap(item => {
        if (typeof item === "object" && item !== null) {
          return explodeRecord(item as Record<string, unknown>);
        }
        return [];
      });
    }
  }

  // Last resort: treat the whole object as one event
  return explodeRecord(obj);
}
