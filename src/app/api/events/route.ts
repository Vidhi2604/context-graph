import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { EventSchema } from "@/types/event";
import { runQuery } from "@/lib/neo4j";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = EventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid event", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const event = parsed.data;
    const eventId = uuidv4();
    const timestamp = event.timestamp || new Date().toISOString();

    // Merge User node, create Event node, link them
    await runQuery(
      `
      MERGE (u:User {user_id: $user_id})
      CREATE (e:Event {
        id: $id,
        event_type: $event_type,
        timestamp: datetime($timestamp),
        properties: $properties,
        context: $context,
        created_at: datetime()
      })
      CREATE (u)-[:PERFORMED]->(e)
      WITH u, e
      FOREACH (_ IN CASE WHEN $session_id IS NOT NULL THEN [1] ELSE [] END |
        MERGE (s:Session {session_id: $session_id})
        MERGE (u)-[:HAS_SESSION]->(s)
        CREATE (s)-[:CONTAINS]->(e)
      )
      `,
      {
        id: eventId,
        user_id: event.user_id,
        event_type: event.event_type,
        timestamp,
        session_id: event.session_id ?? null,
        properties: JSON.stringify(event.properties ?? {}),
        context: JSON.stringify(event.context ?? {}),
      }
    );

    return NextResponse.json(
      { success: true, event_id: eventId, timestamp },
      { status: 201 }
    );
  } catch (error) {
    console.error("Event ingestion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
