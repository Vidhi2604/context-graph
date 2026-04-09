import { runQuery } from "./neo4j";

export interface Alert {
  alert_id: string;
  type: "policy_drift" | "risk_signal" | "anomaly_spike";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  data: Record<string, unknown>;
}

export async function detectPolicyDrift(
  tenantId: string,
  vertical: string,
  threshold: number = 0.3
): Promise<Alert[]> {
  // Use OVERRODE for retail, DEVIATED_FROM for healthcare
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

    return results.map((r, i) => ({
      alert_id: `drift_${i}`,
      type: "policy_drift" as const,
      severity: r.override_rate > 0.6 ? "critical" as const : "warning" as const,
      title: `${r.policy} ${r.version}: ${Math.round(r.override_rate * 100)}% override rate`,
      description: `${r.overrides} overrides out of ${r.total} total applications in the last 90 days.`,
      data: r as unknown as Record<string, unknown>,
    }));
  } catch {
    // No OVERRODE/DEVIATED_FROM edges exist yet — no drift to detect
    return [];
  }
}

export async function detectAnomalySpikes(
  tenantId: string,
  vertical: string,
  spikeMultiplier: number = 2.0
): Promise<Alert[]> {
  // Use correct node label per vertical
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

    return results.map((r, i) => ({
      alert_id: `spike_${i}`,
      type: "anomaly_spike" as const,
      severity: r.multiplier > 3 ? "critical" as const : "warning" as const,
      title: `${r.event_type.replace(/_/g, " ")} spiked ${r.multiplier}x this week`,
      description: `${r.this_week} this week vs ${r.weekly_avg} weekly average.`,
      data: r as unknown as Record<string, unknown>,
    }));
  } catch {
    // No events in time range — no spikes to detect
    return [];
  }
}

export async function getAllAlerts(
  tenantId: string,
  vertical: string
): Promise<Alert[]> {
  const [drift, spikes] = await Promise.all([
    detectPolicyDrift(tenantId, vertical),
    detectAnomalySpikes(tenantId, vertical),
  ]);
  return [...drift, ...spikes].sort((a, b) =>
    a.severity === "critical" ? -1 : b.severity === "critical" ? 1 : 0
  );
}
