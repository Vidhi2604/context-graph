export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";

// Generates filter options from actual data in Neo4j for this tenant
export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const t = session.tenantId;
    const isRetail = session.vertical !== "healthcare";
    const eventLabel = isRetail ? "Event" : "Visit";

    const toNum = (v: unknown): number =>
      v && typeof v === "object" && "low" in v ? (v as { low: number }).low : Number(v) || 0;

    // Fetch distinct values for filterable properties from actual data
    const [cities, tiers, eventTypes, paymentMethods, statuses, nodeLabels] = await Promise.all([
      // Profile-level
      runQuery<{ val: string }>(`MATCH (p:Profile {_tenant:$t}) WHERE p.city IS NOT NULL RETURN DISTINCT p.city AS val ORDER BY val LIMIT 30`, { t }),
      runQuery<{ val: string }>(`MATCH (p:Profile {_tenant:$t}) WHERE p.tier IS NOT NULL RETURN DISTINCT p.tier AS val ORDER BY val LIMIT 20`, { t }),
      // Event-level
      runQuery<{ val: string; count: unknown }>(`MATCH (e:${eventLabel} {_tenant:$t}) WHERE e.event_type IS NOT NULL RETURN DISTINCT e.event_type AS val, count(e) AS count ORDER BY count DESC LIMIT 20`, { t }),
      runQuery<{ val: string }>(`MATCH (e:${eventLabel} {_tenant:$t}) WHERE e.payment_method IS NOT NULL RETURN DISTINCT e.payment_method AS val ORDER BY val LIMIT 15`, { t }),
      runQuery<{ val: string }>(`MATCH (e:${eventLabel} {_tenant:$t}) WHERE e.status IS NOT NULL RETURN DISTINCT e.status AS val ORDER BY val LIMIT 10`, { t }),
      // All node labels present for this tenant (for dynamic graph legend)
      runQuery<{ label: string; count: unknown }>(`MATCH (n) WHERE n._tenant = $t WITH n UNWIND labels(n) AS label WITH label, count(n) AS cnt WHERE label <> '_tenant' RETURN DISTINCT label, cnt AS count ORDER BY count DESC LIMIT 20`, { t }),
    ]);

    const filters = [];

    // City filter
    const cityOptions = cities.map(r => r.val).filter(Boolean);
    if (cityOptions.length > 0) {
      filters.push({ id: "city", label: "City", type: "select", options: cityOptions, cypherField: "p.city" });
    }

    // Tier filter
    const tierOptions = tiers.map(r => r.val).filter(Boolean);
    if (tierOptions.length > 0) {
      filters.push({ id: "tier", label: "Tier", type: "select", options: tierOptions, cypherField: "p.tier" });
    }

    // Event type filter
    const eventTypeOptions = eventTypes.map(r => r.val).filter(Boolean);
    if (eventTypeOptions.length > 0) {
      filters.push({ id: "event_type", label: "Event Type", type: "select", options: eventTypeOptions, cypherField: "e.event_type" });
    }

    // Payment method filter
    const paymentOptions = paymentMethods.map(r => r.val).filter(Boolean);
    if (paymentOptions.length > 0) {
      filters.push({ id: "payment", label: "Payment", type: "select", options: paymentOptions, cypherField: "e.payment_method" });
    }

    // Status filter
    const statusOptions = statuses.map(r => r.val).filter(Boolean);
    if (statusOptions.length > 0) {
      filters.push({ id: "status", label: "Status", type: "select", options: statusOptions, cypherField: "e.status" });
    }

    // Date range (always available)
    filters.push({ id: "dateRange", label: "Date Range", type: "date", cypherField: "e.timestamp" });

    // Node labels present in graph (for dynamic legend/colors)
    const presentLabels = nodeLabels
      .map(r => ({ label: r.label, count: toNum(r.count) }))
      .filter(r => r.label !== "Identity");

    return NextResponse.json({ filters, presentLabels, vertical: session.vertical });
  } catch (error) {
    return errorResponse(error);
  }
}
