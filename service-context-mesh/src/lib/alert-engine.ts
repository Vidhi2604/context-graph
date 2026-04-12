import { runQuery } from "./neo4j";

export interface Alert {
  alert_id: string;
  type: "policy_drift" | "risk_signal" | "anomaly_spike";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  data: Record<string, unknown>;
}

// ── Policy Drift ──────────────────────────────────────────────────

export async function detectPolicyDrift(
  tenantId: string,
  vertical: string,
  threshold: number = 0.3
): Promise<Alert[]> {
  const eventLabel = vertical === "retail" ? "Event" : "Visit";
  const overrideRel = vertical === "retail" ? "OVERRODE" : "DEVIATED_FROM";
  const policyLabel = vertical === "retail" ? "Policy" : "Protocol";

  try {
    const results = await runQuery<{
      policy: string;
      version: string;
      override_rate: number;
      overrides: number;
      total: number;
    }>(
      `
      MATCH (e:${eventLabel} {_tenant: $tenantId})-[:${overrideRel}]->(pol:${policyLabel} {status: 'active'})
      WHERE e.timestamp >= datetime() - duration("P90D")
      WITH pol, count(e) AS overrides
      OPTIONAL MATCH (e2:${eventLabel} {_tenant: $tenantId})-[:GOVERNED_BY]->(pol)
      WHERE e2.timestamp >= datetime() - duration("P90D")
      WITH pol, overrides, count(e2) AS followed
      WITH pol, overrides, followed,
           CASE WHEN overrides + followed = 0 THEN 0
                ELSE toFloat(overrides) / (overrides + followed) END AS override_rate
      WHERE override_rate > $threshold
      RETURN pol.name AS policy, pol.version AS version,
             override_rate, overrides, overrides + followed AS total
      ORDER BY override_rate DESC
      `,
      { tenantId, threshold }
    );

    const toN = (v: unknown): number => (v && typeof v === "object" && "low" in v) ? (v as {low: number}).low : Number(v) || 0;

    return results.map((r, i) => {
      const overrides = toN(r.overrides);
      const total = toN(r.total);
      const overrideRate = typeof r.override_rate === "number" ? r.override_rate : toN(r.override_rate);
      return {
        alert_id: `drift_${i}`,
        type: "policy_drift" as const,
        severity: overrideRate > 0.6 ? "critical" as const : "warning" as const,
        title: `${r.policy} ${r.version}: ${Math.round(overrideRate * 100)}% override rate`,
        description: `${overrides} overrides out of ${total} total applications in the last 90 days.`,
        data: { policy: r.policy, version: r.version, status: "active", override_rate: overrideRate, overrides, total },
      };
    });
  } catch {
    return [];
  }
}

// ── Anomaly Spikes ────────────────────────────────────────────────

export async function detectAnomalySpikes(
  tenantId: string,
  vertical: string,
  spikeMultiplier: number = 2.0
): Promise<Alert[]> {
  const eventLabel = vertical === "retail" ? "Event" : "Visit";
  const typeField = vertical === "retail" ? "event_type" : "type";

  try {
    const results = await runQuery<{
      event_type: string;
      this_week: number;
      weekly_avg: number;
      multiplier: number;
    }>(
      `
      MATCH (e:${eventLabel} {_tenant: $tenantId})
      WHERE e.timestamp >= datetime() - duration("P7D")
      WITH e.${typeField} AS event_type, count(*) AS this_week
      MATCH (e2:${eventLabel} {_tenant: $tenantId})
      WHERE e2.${typeField} = event_type
        AND e2.timestamp >= datetime() - duration("P30D")
        AND e2.timestamp < datetime() - duration("P7D")
      WITH event_type, this_week,
           toFloat(count(e2)) / 3.29 AS weekly_avg
      WHERE this_week > weekly_avg * $spikeMultiplier AND weekly_avg > 0
      RETURN event_type, this_week, round(weekly_avg, 0) AS weekly_avg,
             round(toFloat(this_week) / weekly_avg, 1) AS multiplier
      ORDER BY multiplier DESC
      `,
      { tenantId, spikeMultiplier }
    );

    const toN = (v: unknown): number => (v && typeof v === "object" && "low" in v) ? (v as {low: number}).low : Number(v) || 0;

    return results.map((r, i) => {
      const thisWeek = toN(r.this_week);
      const weeklyAvg = toN(r.weekly_avg);
      const multiplier = toN(r.multiplier);
      return {
        alert_id: `spike_${i}`,
        type: "anomaly_spike" as const,
        severity: multiplier > 3 ? "critical" as const : "warning" as const,
        title: `${String(r.event_type).replace(/_/g, " ")} spiked ${multiplier}x this week`,
        description: `${thisWeek} this week vs ${weeklyAvg} weekly average.`,
        data: { event_type: r.event_type, this_week: thisWeek, weekly_avg: weeklyAvg, multiplier },
      };
    });
  } catch {
    return [];
  }
}

// ── Risk Scoring — Retail (Churn Risk) ───────────────────────────

export async function detectChurnRisks(
  tenantId: string,
  threshold: number = 0.6
): Promise<Alert[]> {
  try {
    const results = await runQuery<{
      profile_id: string;
      name: string;
      tier: string;
      city: string;
      returns: number;
      purchases: number;
      escalations: number;
      breached_commitments: number;
      risk_score: number;
    }>(
      `
      MATCH (p:Profile {_tenant: $tenantId, _vertical: 'retail'})
      WHERE p.archived IS NULL
      WITH p

      // Count returns in last 90 days
      OPTIONAL MATCH (p)-[:PERFORMED]->(e_ret:Event {event_type: 'return_initiated', _tenant: $tenantId})
      WHERE e_ret.timestamp >= datetime() - duration("P90D")
      WITH p, count(e_ret) AS returns

      // Count purchases in last 90 days
      OPTIONAL MATCH (p)-[:PERFORMED]->(e_pur:Event {event_type: 'purchase', _tenant: $tenantId})
      WHERE e_pur.timestamp >= datetime() - duration("P90D")
      WITH p, returns, count(e_pur) AS purchases

      // Count support escalations
      OPTIONAL MATCH (p)-[:PERFORMED]->(e_sup:Event {event_type: 'support_ticket', _tenant: $tenantId})
      WHERE e_sup.timestamp >= datetime() - duration("P90D")
      WITH p, returns, purchases, count(e_sup) AS escalations

      // Count breached commitments
      OPTIONAL MATCH (p)-[:HAS_COMMITMENT]->(c:Commitment {status: 'breached', _tenant: $tenantId})
      WITH p, returns, purchases, escalations, count(c) AS breached_commitments

      // Compute risk score
      WITH p, returns, purchases, escalations, breached_commitments,
           round(
             (CASE WHEN purchases = 0 THEN 0.3 ELSE toFloat(returns) / purchases * 0.35 END)
             + (escalations * 0.15)
             + (breached_commitments * 0.20)
             + (CASE WHEN returns >= 3 THEN 0.15 ELSE 0.0 END)
           , 2) AS risk_score
      WHERE risk_score >= $threshold
        AND (returns > 0 OR escalations > 0 OR breached_commitments > 0)
      RETURN p.profile_id AS profile_id, p.name AS name,
             p.tier AS tier, p.city AS city,
             returns, purchases, escalations, breached_commitments, risk_score
      ORDER BY risk_score DESC
      LIMIT 10
      `,
      { tenantId, threshold }
    );

    return results.map((r, i) => {
      const signals: string[] = [];
      if (r.breached_commitments > 0) signals.push(`${r.breached_commitments} breached promise(s)`);
      if (r.returns > 1) signals.push(`${r.returns} returns in 90 days`);
      if (r.escalations > 1) signals.push(`${r.escalations} support escalations`);

      return {
        alert_id: `churn_${i}`,
        type: "risk_signal" as const,
        severity: r.risk_score > 0.8 ? "critical" as const : "warning" as const,
        title: `Churn risk: ${r.name || r.profile_id} (${r.tier || "unknown"} tier)`,
        description: `Risk score: ${Math.round(r.risk_score * 100)}%. Signals: ${signals.join(", ") || "pattern-based"}`,
        data: r as unknown as Record<string, unknown>,
      };
    });
  } catch {
    return [];
  }
}

// ── Risk Scoring — Healthcare (Readmission Risk) ──────────────────

export async function detectReadmissionRisks(
  tenantId: string,
  threshold: number = 0.5
): Promise<Alert[]> {
  try {
    const results = await runQuery<{
      profile_id: string;
      name: string;
      age: number;
      city: string;
      prior_readmissions: number;
      missed_followups: number;
      recent_critical_visits: number;
      breached_commitments: number;
      risk_score: number;
    }>(
      `
      MATCH (p:Profile {_tenant: $tenantId, _vertical: 'healthcare'})
      WHERE p.archived IS NULL
      WITH p

      // Prior readmissions
      OPTIONAL MATCH (p)-[:READMITTED]->(v_re:Visit {_tenant: $tenantId})
      WHERE v_re.timestamp >= datetime() - duration("P180D")
      WITH p, count(v_re) AS prior_readmissions

      // Missed follow-up commitments (breached)
      OPTIONAL MATCH (p)-[:HAS_COMMITMENT]->(c:Commitment {status: 'breached', _tenant: $tenantId})
      WHERE c.promise_text CONTAINS 'follow' OR c.promise_text CONTAINS 'angiogram'
      WITH p, prior_readmissions, count(c) AS missed_followups

      // Recent critical/high priority visits
      OPTIONAL MATCH (p)-[:HAD_VISIT]->(v_crit:Visit {_tenant: $tenantId})
      WHERE v_crit.priority IN ['Critical', 'High']
        AND v_crit.timestamp >= datetime() - duration("P60D")
      WITH p, prior_readmissions, missed_followups, count(v_crit) AS recent_critical_visits

      // Any breached commitments (general)
      OPTIONAL MATCH (p)-[:HAS_COMMITMENT]->(c2:Commitment {status: 'breached', _tenant: $tenantId})
      WITH p, prior_readmissions, missed_followups, recent_critical_visits, count(c2) AS breached_commitments

      // Compute readmission risk score
      WITH p, prior_readmissions, missed_followups, recent_critical_visits, breached_commitments,
           round(
             (prior_readmissions * 0.35)
             + (missed_followups * 0.30)
             + (CASE WHEN recent_critical_visits > 0 THEN 0.20 ELSE 0.0 END)
             + (breached_commitments * 0.15)
           , 2) AS risk_score
      WHERE risk_score >= $threshold
        AND (prior_readmissions > 0 OR missed_followups > 0 OR recent_critical_visits > 0)
      RETURN p.profile_id AS profile_id, p.name AS name,
             p.age AS age, p.city AS city,
             prior_readmissions, missed_followups, recent_critical_visits,
             breached_commitments, risk_score
      ORDER BY risk_score DESC
      LIMIT 10
      `,
      { tenantId, threshold }
    );

    return results.map((r, i) => {
      const signals: string[] = [];
      if (r.prior_readmissions > 0) signals.push(`${r.prior_readmissions} prior readmission(s)`);
      if (r.missed_followups > 0) signals.push(`${r.missed_followups} missed follow-up(s)`);
      if (r.recent_critical_visits > 0) signals.push(`${r.recent_critical_visits} critical visit(s) in 60 days`);

      return {
        alert_id: `readmit_${i}`,
        type: "risk_signal" as const,
        severity: r.risk_score > 0.7 ? "critical" as const : "warning" as const,
        title: `Readmission risk: ${r.name || r.profile_id}${r.age ? ` (age ${r.age})` : ""}`,
        description: `Risk score: ${Math.round(r.risk_score * 100)}%. Signals: ${signals.join(", ") || "pattern-based"}`,
        data: r as unknown as Record<string, unknown>,
      };
    });
  } catch {
    return [];
  }
}

// ── Get All Alerts (combines all detectors) ───────────────────────

export async function getAllAlerts(
  tenantId: string,
  vertical: string
): Promise<Alert[]> {
  const detectors = [
    detectPolicyDrift(tenantId, vertical),
    detectAnomalySpikes(tenantId, vertical),
    vertical === "retail"
      ? detectChurnRisks(tenantId)
      : detectReadmissionRisks(tenantId),
  ];

  const results = await Promise.all(detectors);
  const all = results.flat();

  return all.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}
