import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;

    const events = await runQuery(
      `
      MATCH (u:User {user_id: $user_id})-[:PERFORMED]->(e:Event)
      OPTIONAL MATCH (s:Session)-[:CONTAINS]->(e)
      RETURN e.id AS id,
             e.event_type AS event_type,
             e.timestamp AS timestamp,
             e.properties AS properties,
             e.context AS context,
             s.session_id AS session_id
      ORDER BY e.timestamp ASC
      `,
      { user_id: userId }
    );

    if (events.length === 0) {
      return NextResponse.json(
        { error: "User not found or no events" },
        { status: 404 }
      );
    }

    const parsed = events.map((e: Record<string, unknown>) => ({
      id: e.id,
      event_type: e.event_type,
      timestamp: String(e.timestamp),
      session_id: e.session_id ?? null,
      properties: safeJsonParse(e.properties),
      context: safeJsonParse(e.context),
    }));

    return NextResponse.json({ user_id: userId, events: parsed });
  } catch (error) {
    console.error("User events error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function safeJsonParse(val: unknown): Record<string, unknown> {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }
  if (typeof val === "object" && val !== null) {
    return val as Record<string, unknown>;
  }
  return {};
}
