export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Simple secret check to avoid exposing this publicly
  const secret = req.nextUrl.searchParams.get("secret") || req.headers.get("x-debug-secret");
  if (secret !== (process.env.CRON_SECRET || "dev")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {},
    checks: {},
  };

  // ── Env var presence (never expose values, just presence) ──
  const envVars = [
    "NEO4J_URI", "NEO4J_USER", "NEO4J_PASSWORD",
    "DATABASE_URL",
    "NEXTAUTH_SECRET", "NEXTAUTH_URL",
    "ANTHROPIC_API_KEY", "ANTHROPIC_KEY",
    "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
    "CRON_SECRET", "DEMO_MODE",
  ];
  for (const v of envVars) {
    (results.env as Record<string, string>)[v] = process.env[v] ? "SET" : "MISSING";
  }

  // ── Neo4j connectivity test ──
  try {
    const { runQuery } = await import("@/lib/neo4j");
    const rows = await runQuery<{ ping: number }>("RETURN 1 AS ping");
    (results.checks as Record<string, unknown>).neo4j = {
      ok: true,
      result: rows[0]?.ping,
      uri: process.env.NEO4J_URI ? process.env.NEO4J_URI.replace(/\/\/.*@/, "//[redacted]@") : "NOT SET",
    };
  } catch (e) {
    (results.checks as Record<string, unknown>).neo4j = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── Prisma connectivity test ──
  try {
    const { prisma } = await import("@/lib/prisma");
    const count = await prisma.org.count();
    (results.checks as Record<string, unknown>).prisma = { ok: true, org_count: count };
  } catch (e) {
    (results.checks as Record<string, unknown>).prisma = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── Neo4j data count ──
  try {
    const { runQuery } = await import("@/lib/neo4j");
    const countRows = await runQuery<{ profiles: number; events: number }>(
      "MATCH (p:Profile) WITH count(p) AS profiles OPTIONAL MATCH (e:Event) RETURN profiles, count(e) AS events"
    );
    (results.checks as Record<string, unknown>).neo4j_data = {
      profiles: countRows[0]?.profiles ?? 0,
      events: countRows[0]?.events ?? 0,
    };
  } catch (e) {
    (results.checks as Record<string, unknown>).neo4j_data = {
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const allOk = Object.values(results.checks as Record<string, unknown>).every(
    (c) => (c as { ok?: boolean }).ok !== false
  );

  return NextResponse.json(results, { status: allOk ? 200 : 500 });
}
