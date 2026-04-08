import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { BatchEventsSchema } from "@/types/event";
import { runQuery } from "@/lib/neo4j";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BatchEventsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid batch", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const events = parsed.data.events.map((e) => ({
      id: uuidv4(),
      event_type: e.event_type,
      user_id: e.user_id,
      session_id: e.session_id ?? null,
      timestamp: e.timestamp || new Date().toISOString(),
      properties: JSON.stringify(e.properties ?? {}),
      context: JSON.stringify(e.context ?? {}),
    }));

    // UNWIND for batch insert
    await runQuery(
      `
      UNWIND $events AS evt
      MERGE (u:User {user_id: evt.user_id})
      CREATE (e:Event {
        id: evt.id,
        event_type: evt.event_type,
        timestamp: datetime(evt.timestamp),
        properties: evt.properties,
        context: evt.context,
        created_at: datetime()
      })
      CREATE (u)-[:PERFORMED]->(e)
      WITH u, e, evt
      FOREACH (_ IN CASE WHEN evt.session_id IS NOT NULL THEN [1] ELSE [] END |
        MERGE (s:Session {session_id: evt.session_id})
        MERGE (u)-[:HAS_SESSION]->(s)
        CREATE (s)-[:CONTAINS]->(e)
      )
      `,
      { events }
    );

    return NextResponse.json(
      {
        success: true,
        ingested: events.length,
        event_ids: events.map((e) => e.id),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Batch ingestion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
