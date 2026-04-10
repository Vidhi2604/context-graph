/**
 * redact.ts — PHI/PII scrubbing utilities
 *
 * Used in two places:
 *   1. Before sending transcripts to the LLM (redactPHI)
 *   2. Before writing failed events to the DLQ (scrubForDlq)
 *
 * Production upgrade: replace redactPHI() with Presidio (open-source,
 * runs in-cluster) — zero data leaves the compute boundary.
 */

export function redactPHI(text: string, knownNames: string[] = []): string {
  let safe = text;

  // Indian MRN patterns: 2–4 uppercase letters, optional dash, 4–8 digits
  safe = safe.replace(/\b[A-Z]{2,4}-?\d{4,8}\b/g, "[MRN]");

  // Aadhaar: 12-digit number with optional spaces or dashes between groups of 4
  safe = safe.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[AADHAAR]");

  // Indian phone: 10-digit starting with 6–9, optional +91 prefix
  safe = safe.replace(/(?:\+91[\s-]?)?[6-9]\d{9}\b/g, "[PHONE]");

  // Email addresses
  safe = safe.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[EMAIL]");

  // Known participant names — only redact names longer than 2 characters
  for (const name of knownNames) {
    if (name && name.length > 2) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      safe = safe.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "[NAME]");
    }
  }

  return safe;
}

export function scrubForDlq(rawPayload: string): string {
  try {
    const event = JSON.parse(rawPayload) as Record<string, unknown>;

    if (event.identifiers && typeof event.identifiers === "object") {
      const identifiers = event.identifiers as Record<string, unknown>;
      for (const field of ["aadhaar", "mrn", "ssn", "passport"]) {
        if (identifiers[field] !== undefined) identifiers[field] = "[REDACTED]";
      }
    }

    if (event.profile_data !== undefined) event.profile_data = { _scrubbed: true };

    if (event.properties && typeof event.properties === "object") {
      const props = event.properties as Record<string, unknown>;
      if (props.transcript !== undefined) props.transcript = "[REDACTED]";
    }

    return JSON.stringify(event);
  } catch {
    return JSON.stringify({ _error: "unparseable_payload", _scrubbed: true });
  }
}
