import { z } from "zod";

// ---- Zod schemas (validation at API boundary) ----

export const EventPropertiesSchema = z.record(z.string(), z.unknown());

export const EventSchema = z.object({
  event_type: z.string().min(1),
  user_id: z.string().min(1),
  session_id: z.string().optional(),
  timestamp: z.string().datetime().optional(), // ISO 8601; defaults to now
  properties: EventPropertiesSchema.optional(),
  context: z
    .object({
      page_url: z.string().optional(),
      referrer: z.string().optional(),
      user_agent: z.string().optional(),
      ip: z.string().optional(),
      device: z.string().optional(),
      os: z.string().optional(),
      browser: z.string().optional(),
    })
    .optional(),
});

export const BatchEventsSchema = z.object({
  events: z.array(EventSchema).min(1).max(1000),
});

// ---- TypeScript types (derived from Zod) ----

export type EventInput = z.infer<typeof EventSchema>;
export type BatchEventsInput = z.infer<typeof BatchEventsSchema>;

export interface StoredEvent {
  id: string;
  event_type: string;
  user_id: string;
  session_id: string | null;
  timestamp: string;
  properties: Record<string, unknown>;
  context: Record<string, unknown>;
  created_at: string;
}

// ---- Common event types for the retail demo ----

export const RETAIL_EVENT_TYPES = [
  "app_install",
  "page_view",
  "product_view",
  "search",
  "add_to_cart",
  "remove_from_cart",
  "begin_checkout",
  "add_payment_info",
  "purchase",
  "delivery_scheduled",
  "delivery_completed",
  "return_initiated",
  "return_completed",
  "refund_issued",
  "support_ticket",
  "review_submitted",
] as const;

export type RetailEventType = (typeof RETAIL_EVENT_TYPES)[number];
