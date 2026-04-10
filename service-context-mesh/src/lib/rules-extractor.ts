/**
 * Tiered Extraction Pipeline — Tier 1: Rules Engine
 *
 * Handles ~80% of high-signal events without any LLM call.
 * Saves token cost and latency. Only falls through to LLM for ambiguous input.
 *
 * Tier 1 (this file): keyword/pattern matching → deterministic extraction
 * Tier 2 (llm.ts):    LLM extraction for complex/ambiguous cases
 */

interface RulesExtractResult {
  matched: boolean;
  event_type?: string;
  confidence_score: number;
  properties: Record<string, unknown>;
  commitments?: { promise_text: string; deadline: string | null; assignee: string | null; confidence_score: number }[];
}

// ── Retail rules ────────────────────────────────────────────────────

const RETAIL_RULES: Array<{
  patterns: RegExp[];
  event_type: string;
  extract?: (text: string) => Record<string, unknown>;
}> = [
  {
    patterns: [/\b(purchased|bought|placed order|confirmed order|checkout complete)\b/i],
    event_type: "purchase",
    extract: (text) => ({
      amount: extractAmount(text),
      channel: extractChannel(text),
    }),
  },
  {
    patterns: [/\b(return(ed)?|refund request|want to return|initiat(e|ed|ing) return)\b/i],
    event_type: "return_initiated",
    extract: (text) => ({ reason: extractReturnReason(text) }),
  },
  {
    patterns: [/\b(add(ed)? to cart|added.*cart|cart.*added)\b/i],
    event_type: "add_to_cart",
    extract: () => ({}),
  },
  {
    patterns: [/\b(support ticket|complaint|escalat(e|ed|ion)|filed.*issue|raised.*complaint)\b/i],
    event_type: "support_ticket",
    extract: (text) => ({ subject: text.slice(0, 100) }),
  },
  {
    patterns: [/\b(deliver(y|ed)|shipment arrived|package.*received|out for delivery)\b/i],
    event_type: "delivery_completed",
    extract: () => ({}),
  },
  {
    patterns: [/\b(review(ed)?|rat(ed|ing)|gave.*stars?|feedback.*submitted)\b/i],
    event_type: "review_submitted",
    extract: (text) => ({ rating: extractRating(text) }),
  },
  {
    patterns: [/\b(cancel(led)?|cancell?ation|cancelled order)\b/i],
    event_type: "order_cancelled",
    extract: () => ({}),
  },
];

// ── Healthcare rules ────────────────────────────────────────────────

const HEALTHCARE_RULES: Array<{
  patterns: RegExp[];
  event_type: string;
  visit_type?: string;
  extract?: (text: string) => Record<string, unknown>;
}> = [
  {
    patterns: [/\b(admitted|emergency|ER visit|urgently|came in|brought in)\b/i],
    event_type: "visit",
    visit_type: "Emergency",
    extract: () => ({}),
  },
  {
    patterns: [/\b(follow.?up|follow up appointment|scheduled.*follow|next visit)\b/i],
    event_type: "visit",
    visit_type: "Follow-up",
    extract: (text) => ({ commitments: extractFollowUpCommitments(text) }),
  },
  {
    patterns: [/\b(surgery|operat(ion|ed)|procedure|surgical)\b/i],
    event_type: "visit",
    visit_type: "Surgery",
    extract: () => ({}),
  },
  {
    patterns: [/\b(discharged?|discharge summary|sent home|released)\b/i],
    event_type: "visit",
    visit_type: "Outpatient",
    extract: () => ({}),
  },
  {
    patterns: [/\b(prescribed?|medication|dosage|take.*mg|mg.*daily)\b/i],
    event_type: "medication_prescribed",
    extract: (text) => ({ medication: extractMedication(text) }),
  },
  {
    patterns: [/\b(diagnosed?|diagnosis|condition|suffering from|presenting with)\b/i],
    event_type: "diagnosis",
    extract: (text) => ({ condition: text.slice(0, 120) }),
  },
  {
    patterns: [/\b(claim (submitted|filed|approved|denied)|insurance (claim|coverage))\b/i],
    event_type: "insurance_claim",
    extract: (text) => ({ status: /denied/i.test(text) ? "Denied" : /approved/i.test(text) ? "Approved" : "Pending" }),
  },
];

// ── Commitment detection (both verticals) ──────────────────────────

const COMMITMENT_PATTERNS = [
  /\b(will|going to|shall|promise|commit(ted)?|guarantee|ensure|make sure).{0,60}(by|before|within|on)\s+[A-Z][a-z]+\s+\d/i,
  /\b(call (you|back)|follow up|schedule|book|arrange).{0,40}(tomorrow|next|within \d+ day)/i,
  /\b(waiv(e|ing)|refund(ing)?|replac(e|ing)|credi(t|ting)).{0,60}(within|by|in \d)/i,
];

// ── Public API ──────────────────────────────────────────────────────

export function rulesExtract(text: string, vertical: "retail" | "healthcare"): RulesExtractResult {
  const rules = vertical === "retail" ? RETAIL_RULES : HEALTHCARE_RULES;

  for (const rule of rules) {
    if (rule.patterns.some((p) => p.test(text))) {
      const extracted = rule.extract?.(text) || {};
      const commitments = extracted.commitments as RulesExtractResult["commitments"] | undefined;
      const baseProps: Record<string, unknown> = { ...extracted };
      delete baseProps.commitments;

      // Add visit_type for healthcare
      if ("visit_type" in rule) {
        baseProps.visit_type = (rule as { visit_type?: string }).visit_type;
      }

      // Extract commitments from text
      const detectedCommitments = commitments || extractCommitmentsFromText(text);

      return {
        matched: true,
        event_type: rule.event_type,
        confidence_score: 0.88, // rules are high-confidence by definition
        properties: baseProps,
        ...(detectedCommitments.length > 0 ? { commitments: detectedCommitments } : {}),
      };
    }
  }

  return { matched: false, confidence_score: 0, properties: {} };
}

export function shouldUseLLM(text: string): boolean {
  // Use LLM only if rules didn't match and text is substantive
  return text.length > 50;
}

// ── Helpers ─────────────────────────────────────────────────────────

function extractAmount(text: string): number | null {
  const match = text.match(/₹\s*([\d,]+)|rs\.?\s*([\d,]+)|\b([\d,]+)\s*rupees/i);
  if (!match) return null;
  const raw = (match[1] || match[2] || match[3]).replace(/,/g, "");
  return parseInt(raw, 10) || null;
}

function extractChannel(text: string): string {
  if (/app|mobile/i.test(text)) return "app";
  if (/web|site|website/i.test(text)) return "web";
  if (/phone|call/i.test(text)) return "phone";
  return "unknown";
}

function extractReturnReason(text: string): string {
  if (/defect|damage|broken/i.test(text)) return "defective";
  if (/size|fit/i.test(text)) return "size_issue";
  if (/wrong|incorrect/i.test(text)) return "wrong_item";
  if (/quality/i.test(text)) return "quality_issue";
  return "other";
}

function extractRating(text: string): number | null {
  const match = text.match(/(\d)\s*(?:star|\/5|out of 5)/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractMedication(text: string): string {
  const match = text.match(/(\w+(?:cillin|mycin|statin|pril|olol|azole|mab|nib))\b/i);
  return match ? match[1] : "unspecified";
}

function extractFollowUpCommitments(text: string) {
  return extractCommitmentsFromText(text);
}

function extractCommitmentsFromText(text: string) {
  const found: RulesExtractResult["commitments"] = [];
  for (const pattern of COMMITMENT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      found.push({
        promise_text: match[0],
        deadline: null,
        assignee: null,
        confidence_score: 0.78,
      });
    }
  }
  return found;
}
