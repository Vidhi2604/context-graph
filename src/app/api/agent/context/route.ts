import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { runQuery } from "@/lib/neo4j";
import { chatCompletion } from "@/lib/groq";
import { getCommitments } from "@/lib/commitment-tracker";

export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const params = req.nextUrl.searchParams;

    // Resolve profile from any identifier
    const profileId = await resolveFromParams(params, session.tenantId);
    if (!profileId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Run all queries in parallel
    const [profile, recentEvents, commitments, exceptions] = await Promise.all([
      getProfile(profileId, session.tenantId),
      getRecentEvents(profileId, session.tenantId, session.vertical),
      getCommitments(session.tenantId, profileId),
      getExceptions(profileId, session.tenantId, session.vertical),
    ]);

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
      risk_signals: riskSignals,
      suggested_actions: suggestedActions,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function resolveFromParams(
  params: URLSearchParams,
  tenantId: string
): Promise<string | null> {
  // Try direct profile_id
  const profileId = params.get("profile_id");
  if (profileId) return profileId;

  // Try identity lookup
  const identifierTypes = ["phone", "email", "mrn", "aadhaar", "device_id"];
  for (const key of identifierTypes) {
    const value = params.get(key);
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
  const name = params.get("name") || params.get("q");
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
