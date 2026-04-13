export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";

export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const t = session.tenantId;
    const isRetail = session.vertical === "retail";
    const eventLabel = isRetail ? "Event" : "Visit";

    const [profiles, eventTypes, cities, tiers] = await Promise.all([
      runQuery<{ name: string }>(`MATCH (p:Profile {_tenant:$t}) WHERE p.name IS NOT NULL RETURN DISTINCT p.name AS name LIMIT 8`, { t }),
      runQuery<{ val: string }>(`MATCH (e:${eventLabel} {_tenant:$t}) WHERE e.event_type IS NOT NULL RETURN DISTINCT e.event_type AS val LIMIT 8`, { t }),
      runQuery<{ val: string }>(`MATCH (p:Profile {_tenant:$t}) WHERE p.city IS NOT NULL RETURN DISTINCT p.city AS val LIMIT 5`, { t }),
      runQuery<{ val: string }>(`MATCH (p:Profile {_tenant:$t}) WHERE p.tier IS NOT NULL RETURN DISTINCT p.tier AS val LIMIT 5`, { t }),
    ]);

    const suggestions: string[] = [];

    if (profiles[0]?.name) suggestions.push(`Show journey for ${profiles[0].name}`);
    if (eventTypes[0]?.val) suggestions.push(`All ${eventTypes[0].val} events`);
    if (cities[0]?.val) suggestions.push(`Customers in ${cities[0].val}`);
    if (tiers[0]?.val) suggestions.push(`${tiers[0].val} tier customers`);

    return NextResponse.json({ suggestions: suggestions.slice(0, 4) });
  } catch (error) {
    return errorResponse(error);
  }
}
