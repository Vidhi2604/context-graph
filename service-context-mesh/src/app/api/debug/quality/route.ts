export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") || req.headers.get("x-debug-secret");
  if (secret !== (process.env.CRON_SECRET || "dev")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [counts, profileCompleteness, eventTypes, topProfiles, connectivity] = await Promise.all([
      // Total counts
      runQuery<{ profiles: unknown; events: unknown; identities: unknown }>(
        `MATCH (p:Profile) WITH count(p) AS profiles
         OPTIONAL MATCH (e:Event) WITH profiles, count(e) AS events
         OPTIONAL MATCH (i:Identity) RETURN profiles, events, count(i) AS identities`
      ),

      // Profile completeness
      runQuery<{ total: unknown; with_email: unknown; with_phone: unknown; with_name: unknown; with_tier: unknown; with_city: unknown }>(
        `MATCH (p:Profile)
         RETURN
           count(p) AS total,
           count(p.email) AS with_email,
           count(p.phone) AS with_phone,
           count(p.name)  AS with_name,
           count(p.tier)  AS with_tier,
           count(p.city)  AS with_city`
      ),

      // Event type distribution
      runQuery<{ event_type: string; count: unknown }>(
        `MATCH (e:Event)
         RETURN e.event_type AS event_type, count(e) AS count
         ORDER BY count DESC LIMIT 15`
      ),

      // Top profiles by event count
      runQuery<{ name: unknown; email: unknown; tier: unknown; event_count: unknown; sources: unknown }>(
        `MATCH (p:Profile)
         OPTIONAL MATCH (p)-[:PERFORMED]->(e:Event)
         WITH p, count(e) AS event_count, collect(DISTINCT e._ingest_source) AS sources
         WHERE event_count > 0
         RETURN p.name AS name, p.email AS email, p.tier AS tier,
                event_count, sources
         ORDER BY event_count DESC LIMIT 10`
      ),

      // Graph connectivity
      runQuery<{ profiles_with_events: unknown; profiles_with_identities: unknown; avg_events_per_profile: unknown }>(
        `MATCH (p:Profile)
         OPTIONAL MATCH (p)-[:PERFORMED]->(e:Event)
         WITH p, count(e) AS ec
         OPTIONAL MATCH (p)-[:HAS_IDENTITY]->(i:Identity)
         RETURN
           count(CASE WHEN ec > 0 THEN 1 END) AS profiles_with_events,
           count(CASE WHEN i IS NOT NULL THEN 1 END) AS profiles_with_identities,
           round(avg(ec) * 10) / 10 AS avg_events_per_profile`
      ),
    ]);

    const toNum = (v: unknown): number => {
      if (typeof v === "number") return v;
      if (v && typeof v === "object" && "low" in v) return (v as { low: number }).low;
      return Number(v ?? 0);
    };

    const total = toNum(profileCompleteness[0]?.total);

    return NextResponse.json({
      totals: {
        profiles: toNum(counts[0]?.profiles),
        events: toNum(counts[0]?.events),
        identities: toNum(counts[0]?.identities),
      },
      profile_completeness: total > 0 ? {
        total,
        with_email:  `${Math.round(toNum(profileCompleteness[0]?.with_email)  / total * 100)}%`,
        with_phone:  `${Math.round(toNum(profileCompleteness[0]?.with_phone)  / total * 100)}%`,
        with_name:   `${Math.round(toNum(profileCompleteness[0]?.with_name)   / total * 100)}%`,
        with_tier:   `${Math.round(toNum(profileCompleteness[0]?.with_tier)   / total * 100)}%`,
        with_city:   `${Math.round(toNum(profileCompleteness[0]?.with_city)   / total * 100)}%`,
      } : {},
      event_type_distribution: eventTypes.map(r => ({
        event_type: r.event_type,
        count: toNum(r.count),
      })),
      connectivity: {
        profiles_with_events:     toNum(connectivity[0]?.profiles_with_events),
        profiles_with_identities: toNum(connectivity[0]?.profiles_with_identities),
        avg_events_per_profile:   toNum(connectivity[0]?.avg_events_per_profile),
      },
      top_profiles_by_activity: topProfiles.map(r => ({
        name:        r.name,
        email:       r.email,
        tier:        r.tier,
        event_count: toNum(r.event_count),
        sources:     r.sources,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
