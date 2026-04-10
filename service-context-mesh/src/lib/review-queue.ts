/**
 * Human-in-the-Loop Review Queue
 *
 * Low confidence (<0.6)    → rejected, goes to DLQ
 * Medium confidence (0.6-0.85) → queued here for human review
 * High confidence (>0.85)  → auto-commit to graph
 */

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface ReviewItem {
  id: string;
  tenantId: string;
  source: "transcript" | "raw" | "connector" | "api";
  confidence_score: number;
  event_type: string;
  identifiers: Record<string, string>;
  profile_data?: Record<string, unknown>;
  payload: Record<string, unknown>;
  reason: string;           // why it was queued
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  status: ReviewStatus;
}

// In-memory store (hackathon). Production: Prisma ReviewItem table + Redis expiry.
const queue = new Map<string, ReviewItem>();

export const CONFIDENCE_THRESHOLDS = {
  AUTO_COMMIT: 0.85,    // > 0.85 → write to graph immediately
  REVIEW:      0.6,     // 0.6 – 0.85 → queue for human review
  REJECT:      0.6,     // < 0.6 → reject outright
} as const;

export type ConfidenceDecision = "auto_commit" | "review" | "reject";

export function classifyConfidence(score: number): ConfidenceDecision {
  if (score >= CONFIDENCE_THRESHOLDS.AUTO_COMMIT) return "auto_commit";
  if (score >= CONFIDENCE_THRESHOLDS.REVIEW) return "review";
  return "reject";
}

export function enqueueForReview(item: Omit<ReviewItem, "id" | "created_at" | "status">): ReviewItem {
  const id = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: ReviewItem = {
    ...item,
    id,
    created_at: new Date().toISOString(),
    status: "pending",
  };
  queue.set(id, entry);
  return entry;
}

export function getQueue(tenantId: string, status?: ReviewStatus): ReviewItem[] {
  return Array.from(queue.values())
    .filter((item) => item.tenantId === tenantId && (!status || item.status === status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getQueueItem(id: string): ReviewItem | null {
  return queue.get(id) || null;
}

export function resolveItem(
  id: string,
  decision: "approved" | "rejected",
  reviewedBy?: string
): ReviewItem | null {
  const item = queue.get(id);
  if (!item || item.status !== "pending") return null;
  item.status = decision;
  item.reviewed_at = new Date().toISOString();
  item.reviewed_by = reviewedBy;
  queue.set(id, item);
  return item;
}

export function getQueueStats(tenantId: string) {
  const items = Array.from(queue.values()).filter((i) => i.tenantId === tenantId);
  return {
    pending: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
    total: items.length,
  };
}
