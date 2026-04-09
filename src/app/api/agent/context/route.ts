import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";
import { chatCompletion } from "@/lib/groq";
import { getCommitments } from "@/lib/commitment-tracker";

// POST instead of GET — PII (phone, email, mrn) should not be in URL params
export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const body = await req.json();

    // Resolve profile from any identifier in the body
    const profileId = await resolveFromBody(body, session.tenantId);
    if (!profileId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Run all queries in parallel
    const [profile, recentEvents, commitments, exceptions, similarCases] = await Promise.all([
      getProfile(profileId, session.tenantId),
      getRecentEvents(profileId, session.tenantId, session.vertical),
      getCommitments(session.tenantId, profileId),
      getExceptions(profileId, session.tenantId, session.vertical),
      findSimilarProfiles(profileId, session.tenantId, session.vertical),
    ]);

    // Compute risk score
    const riskScore = computeRiskScore(recentEvents, commitments, session.vertical);

    // Build risk signals
    const riskSignals = buildRiskSignals(recentEvents, commitments);

    // LLM generates suggested actions
    const suggestedActions = await generateActions(
      profile, recentEvents, commitments, riskSignals, session.vertical
    );

    return NextResponse.json({
      profile,
      recent_events: recentEvents,
      open_commitments: commitments.filter((c: Record<string, unknown>) =>
        c.status === "open" || c.status === "breached"
      ),
      active_exceptions: exceptions,
      similar_cases: similarCases,
      risk_score: riskScore,
      risk_signals: riskSignals,
      suggested_actions: suggestedActions,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function resolveFromBody(
  body: Record<string, string>,
  tenantId: string
): Promise<string | null> {
  // Try direct profile_id
  const profileId = body.profile_id;
  if (profileId) return profileId;

  // Try identity lookup
  const identifierTypes = ["phone", "email", "mrn", "aadhaar", "device_id"];
  for (const key of identifierTypes) {
    const value = body[key];
    if (value) {
      const result = await runQuery<{ profile_id: string }>(
        `
        MATCH (i:Identity {type: $type, value: $value, _tenant: $tenantId})
              <-[:HAS_IDENTITY]-(p:Profile)
        RETURN p.profile_id AS profile_id
        LIMIT 1
        `,
        { type: key, value, tenantId }
      );
      if (result[0]) return result[0].profile_id;
    }
  }

  // Try name search
  const name = body.name || body.q;
  if (name) {
    const result = await runQuery<{ profile_id: string }>(
      `
      MATCH (p:Profile {_tenant: $tenantId})
      WHERE p.name CONTAINS $name
      RETURN p.profile_id AS profile_id
      LIMIT 1
      `,
      { name, tenantId }
    );
    if (result[0]) return result[0].profile_id;
  }

  return null;
}

async function getProfile(profileId: string, tenantId: string) {
  const result = await runQuery(
    `
    MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
    OPTIONAL MATCH (p)-[:HAS_IDENTITY]->(i:Identity)
    RETURN p, collect(i) AS identities
    `,
    { profileId, tenantId }
  );
  return result[0] || null;
}

async function getRecentEvents(profileId: string, tenantId: string, vertical: string) {
  const relType = vertical === "retail" ? "PERFORMED" : "HAD_VISIT";
  return runQuery(
    `
    MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
          -[:${relType}]->(e)
    OPTIONAL MATCH (e)-[:INVOLVES|DIAGNOSED_WITH]->(detail)
    OPTIONAL MATCH (e)-[:GOVERNED_BY|OVERRODE|DEVIATED_FROM]->(pol)
    WITH e, detail, pol,
         duration.inDays(e.timestamp, datetime()).days AS days_ago,
         COALESCE(e.confidence_score, 1.0) AS confidence,
         round(COALESCE(e.confidence_score, 0.9)
           * exp(-0.01 * duration.inDays(e.timestamp, datetime()).days)
           * CASE WHEN pol IS NULL THEN 1.0
                  WHEN pol.status = 'active' THEN 1.0
                  WHEN pol.status = 'superseded' THEN 0.1
                  ELSE 0.5 END
         , 2) AS relevance
    RETURN e, detail, pol, days_ago, confidence, relevance
    ORDER BY relevance DESC
    LIMIT 10
    `,
    { profileId, tenantId }
  );
}

async function getExceptions(profileId: string, tenantId: string, vertical: string) {
  const relType = vertical === "retail" ? "PERFORMED" : "HAD_VISIT";
  const overrideRel = vertical === "retail" ? "OVERRODE" : "DEVIATED_FROM";
  return runQuery(
    `
    MATCH (p:Profile {profile_id: $profileId, _tenant: $tenantId})
          -[:${relType}]->(e)-[:${overrideRel}]->(pol)
    RETURN e.event_type AS event_type, pol.name AS policy,
           pol.version AS version, e.properties AS reason
    ORDER BY e.timestamp DESC
    LIMIT 5
    `,
    { profileId, tenantId }
  );
}

function buildRiskSignals(
  events: Record<string, unknown>[],
  commitments: Record<string, unknown>[]
): string[] {
  const signals: string[] = [];
  const breached = commitments.filter((c) => c.status === "breached");
  if (breached.length > 0) signals.push(`${breached.length} breached commitment(s)`);

  const returns = events.filter((e) =>
    (e as Record<string, unknown>).event_type === "return_initiated" ||
    (e as Record<string, unknown>).event_type === "readmission"
  );
  if (returns.length >= 2) signals.push(`${returns.length} returns/readmissions recently`);

  return signals;
}

async function findSimilarProfiles(
  profileId: string, tenantId: string, vertical: string
): Promise<{ profile: string; similarity: number; outcome: string }[]> {
  const relType = vertical === "retail" ? "PERFORMED" : "HAD_VISIT";
  const detailRel = vertical === "retail" ? "INVOLVES" : "DIAGNOSED_WITH";

  try {
    const results = await runQuery<{
      name: string; shared_count: number; outcome_type: string;
    }>(
      `
      MATCH (source:Profile {profile_id: $profileId, _tenant: $tenantId})
            -[:${relType}]->(e)-[:${detailRel}]->(shared)
      WITH source, collect(DISTINCT shared) AS connections
      UNWIND connections AS conn
      MATCH (other:Profile {_tenant: $tenantId})-[:${relType}]->(e2)-[:${detailRel}]->(conn)
      WHERE other.profile_id <> source.profile_id AND other.archived IS NULL
      WITH other, count(DISTINCT conn) AS shared_count
      ORDER BY shared_count DESC LIMIT 3
      OPTIONAL MATCH (other)-[:${relType}]->(lastEvt)-[:RESULTED_IN]->(o)
      RETURN other.name AS name, shared_count,
             COALESCE(o.type, 'unknown') AS outcome_type
      `,
      { profileId, tenantId }
    );

    return results.map((r) => ({
      profile: r.name || "Unknown",
      similarity: Math.min(r.shared_count / 5, 1.0),
      outcome: r.outcome_type,
    }));
  } catch {
    return [];
  }
}

function computeRiskScore(
  events: Record<string, unknown>[],
  commitments: Record<string, unknown>[],
  vertical: string
): number {
  let score = 0;

  const breached = commitments.filter((c) => c.status === "breached").length;
  score += breached * 0.15;

  if (vertical === "retail") {
    const returns = events.filter((e) =>
      (e as Record<string, unknown>).event_type === "return_initiated"
    ).length;
    const purchases = events.filter((e) =>
      (e as Record<string, unknown>).event_type === "purchase"
    ).length;
    if (purchases > 0) score += (returns / purchases) * 0.3;
    const escalations = events.filter((e) =>
      (e as Record<string, unknown>).event_type === "support_ticket"
    ).length;
    score += escalations * 0.1;
  } else {
    // Healthcare: readmission risk
    const readmissions = events.filter((e) => {
      const props = e as Record<string, unknown>;
      return props.type === "Emergency" || props.event_type === "readmission";
    }).length;
    score += readmissions * 0.2;

    const missedFollowups = commitments.filter((c) =>
      c.status === "breached" && String(c.promise || "").toLowerCase().includes("follow")
    ).length;
    score += missedFollowups * 0.25;
  }

  return Math.min(Math.round(score * 100) / 100, 1.0);
}

async function generateActions(
  profile: Record<string, unknown>,
  events: Record<string, unknown>[],
  commitments: Record<string, unknown>[],
  riskSignals: string[],
  vertical: string
): Promise<{ action: string; confidence: number }[]> {
  const context = JSON.stringify({ profile, recent_events: events.slice(0, 5), commitments: commitments.slice(0, 3), riskSignals });

  const raw = await chatCompletion(
    `You are an agent copilot for a ${vertical} organization. Given customer context, suggest 2-3 specific actions.
Rules: Be specific to THIS customer. Reference actual data. If breached commitment, address it first. Keep each action to 1 sentence.
Return JSON: { "actions": [{ "action": "...", "confidence": 0.0-1.0 }] }`,
    context,
    { jsonMode: true, temperature: 0.2 }
  );

  try {
    const parsed = JSON.parse(raw);
    return (parsed.actions || []).filter((a: { confidence: number }) => a.confidence >= 0.5);
  } catch {
    return [{ action: "Review customer history before proceeding", confidence: 0.6 }];
  }
}
