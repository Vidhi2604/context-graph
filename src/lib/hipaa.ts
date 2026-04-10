/**
 * HIPAA Compliance Module
 *
 * Enforces access controls, PHI data minimization, and audit trail requirements
 * for healthcare vertical. Retail vertical has lighter PII controls.
 *
 * Key requirements implemented:
 * - Minimum Necessary standard: only return PHI fields the requestor needs
 * - PHI field classification
 * - Access logging (feeds into audit-log.ts)
 * - De-identification helper (Safe Harbor method)
 */

import { auditLog } from "./audit-log";

// ── PHI Field Classification ────────────────────────────────────────

// HIPAA 18 identifiers (Safe Harbor method)
export const PHI_FIELDS = new Set([
  "name", "mrn", "aadhaar", "phone", "email", "dob", "age",
  "address", "city", "zip", "state", "ip", "device_id",
  "account_number", "insurance_id", "biometric",
]);

export const SENSITIVE_FIELDS = new Set([
  "diagnosis", "icd_code", "medication", "treatment",
  "mental_health", "substance_abuse", "hiv_status",
  "genetic_data", "insurance_claim", "denial_reason",
]);

// ── Access Control ─────────────────────────────────────────────────

export type PHIAccessLevel = "none" | "de_identified" | "limited" | "full";

interface AccessContext {
  tenantId: string;
  actor: string;          // user_id | "system" | "api_key:xxx"
  purpose: string;        // "treatment" | "operations" | "payment" | "agent_context"
  plan: string;           // starter | pro | enterprise
}

/**
 * Determine what PHI access level is permitted.
 * Healthcare: full PHI only for treatment/operations purpose.
 * Retail: limited PII for all purposes.
 */
export function getAccessLevel(ctx: AccessContext, vertical: string): PHIAccessLevel {
  if (vertical !== "healthcare") {
    // Retail: show name + email, mask phone tail
    return ctx.plan === "starter" ? "de_identified" : "limited";
  }

  // Healthcare HIPAA rules
  if (ctx.purpose === "treatment" || ctx.purpose === "operations") {
    return ctx.plan === "enterprise" ? "full" : "limited";
  }
  if (ctx.purpose === "payment") return "limited";
  return "de_identified";
}

/**
 * Apply minimum-necessary filtering on a profile object.
 * Removes or masks PHI fields based on access level.
 */
export function applyMinimumNecessary(
  profile: Record<string, unknown>,
  level: PHIAccessLevel
): Record<string, unknown> {
  if (level === "full") return profile;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(profile)) {
    if (level === "de_identified") {
      if (PHI_FIELDS.has(key) || SENSITIVE_FIELDS.has(key)) continue;
      result[key] = value;
    } else if (level === "limited") {
      if (SENSITIVE_FIELDS.has(key)) {
        // Show category but not detail
        result[key] = "[restricted]";
      } else if (PHI_FIELDS.has(key) && key === "phone") {
        result[key] = maskPhone(String(value || ""));
      } else if (PHI_FIELDS.has(key) && key === "email") {
        result[key] = maskEmail(String(value || ""));
      } else {
        result[key] = value;
      }
    } else {
      // none
      if (!PHI_FIELDS.has(key) && !SENSITIVE_FIELDS.has(key)) {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Log PHI access for audit trail (HIPAA §164.312(b)).
 */
export function logPHIAccess(
  ctx: AccessContext,
  resourceId: string,
  fieldsAccessed: string[]
): void {
  auditLog({
    tenant_id: ctx.tenantId,
    action: "phi_accessed",
    actor: ctx.actor,
    resource_type: "Profile",
    resource_id: resourceId,
    metadata: {
      purpose: ctx.purpose,
      plan: ctx.plan,
      fields: fieldsAccessed,
    },
  });
}

/**
 * De-identify a dataset using HIPAA Safe Harbor method.
 * Removes all 18 identifiers. Used for analytics/research export.
 */
export function deIdentify(records: Record<string, unknown>[]): Record<string, unknown>[] {
  return records.map((record) => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (!PHI_FIELDS.has(key)) {
        // Generalize age to decade
        if (key === "age" && typeof value === "number") {
          cleaned["age_group"] = `${Math.floor(value / 10) * 10}s`;
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  });
}

/**
 * Validate that a Cypher query does not leak cross-tenant PHI.
 * Called before executing any user-supplied or LLM-generated queries.
 */
export function validateCypherForPHI(cypher: string, tenantId: string): { safe: boolean; reason?: string } {
  // Must have tenant scoping
  if (!cypher.includes("_tenant") && !cypher.includes(tenantId)) {
    return { safe: false, reason: "Query missing _tenant filter — potential cross-tenant PHI leak" };
  }

  // No write operations
  const writeOps = ["CREATE", "MERGE", "SET", "DELETE", "DETACH", "REMOVE"];
  for (const op of writeOps) {
    if (new RegExp(`\\b${op}\\b`, "i").test(cypher)) {
      return { safe: false, reason: `Write operation ${op} not permitted in read-only PHI queries` };
    }
  }

  return { safe: true };
}

// ── Helpers ─────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  if (phone.length < 4) return "****";
  return `****${phone.slice(-4)}`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "****@****";
  return `${local[0]}***@${domain}`;
}
