type InsightResult = {
  finding?: string;
  recommendation?: string;
  confidence?: number;
  impact?: string;
  [key: string]: unknown;
};

/**
 * Evaluates a user-defined condition string against an insight result.
 * Supported syntax:
 *   finding contains "churn"
 *   recommendation contains "escalate"
 *   confidence > 0.8
 *   confidence <= 0.5
 *   impact contains "high"
 *
 * Returns true for empty/blank conditions (always fire).
 * Returns false for unrecognized syntax (fail safe).
 */
export function evaluateCondition(condition: string, result: InsightResult): boolean {
  if (!condition || !condition.trim()) return true;

  const trimmed = condition.trim();

  // Pattern: `<field> contains "<value>"` (case-insensitive)
  const containsMatch = trimmed.match(
    /^(finding|recommendation|confidence|impact)\s+contains\s+"([^"]*)"$/i
  );
  if (containsMatch) {
    const field = containsMatch[1].toLowerCase();
    const needle = containsMatch[2].toLowerCase();
    const haystack = String(result[field] ?? "").toLowerCase();
    return haystack.includes(needle);
  }

  // Pattern: `<field> <op> <number>`
  const numericMatch = trimmed.match(
    /^(finding|recommendation|confidence|impact)\s*(>=|<=|>|<|==|=)\s*([0-9.]+)$/i
  );
  if (numericMatch) {
    const field = numericMatch[1].toLowerCase();
    const op = numericMatch[2];
    const threshold = parseFloat(numericMatch[3]);
    const fieldVal = Number(result[field] ?? NaN);
    if (isNaN(fieldVal) || isNaN(threshold)) return false;
    switch (op) {
      case ">":  return fieldVal > threshold;
      case "<":  return fieldVal < threshold;
      case ">=": return fieldVal >= threshold;
      case "<=": return fieldVal <= threshold;
      case "=":
      case "==": return fieldVal === threshold;
    }
  }

  console.warn("[webhook-condition] Unrecognized condition:", condition);
  return false;
}
