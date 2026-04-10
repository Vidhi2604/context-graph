export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { consumeFromStream, getStreamInfo } from "@/lib/streams";
import { resolveIdentity } from "@/lib/identity-resolver";
import { runQuery } from "@/lib/neo4j";
import { createCommitment } from "@/lib/commitment-tracker";
import { TraceCollector } from "@/lib/trace";
import { v4 as uuidv4 } from "uuid";

// In-memory idempotency (production: use Redis SET with TTL)
const processedKeys = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const traceEnabled = req.nextUrl.searchParams.get("trace") === "true";
    const trace = traceEnabled ? new TraceCollector() : null;

    const session = await getOrgFromRequest(req);
    const isRetail = session.vertical === "retail";

    // Get stream info for trace
    const streamInfo = await getStreamInfo(session.tenantId);

    // Consume from Redis Stream
    const messages = await (trace
      ? trace.run(
          "Redis Stream Consume",
          "XREADGROUP()",
          "kafka",
          `stream: ${streamInfo.key} · length: ${streamInfo.length}`,
          () => consumeFromStream(session.tenantId, 50)
        )
      : consumeFromStream(session.tenantId, 50));

    if (messages.length === 0) {
      return NextResponse.json({ processed: 0, skipped: 0, failed: 0, stream: streamInfo });
    }

    let processed = 0, skipped = 0, failed = 0;

    for (const event of messages) {
      try {
        const key = event._idempotency_key as string;
        if (key && processedKeys.has(key)) { skipped++; continue; }

        // Identity resolution
        const identifiers = (event.identifiers || {}) as Record<string, string>;
        const profileData = (event.profile_data || {}) as Record<string, unknown>;

        const { profileId } = await (trace
          ? trace.run("Identity Resolution", "resolveIdentity()", "neo4j",
              `identifiers: ${Object.keys(identifiers).join(", ")}`,
              () => resolveIdentity(identifiers, session.tenantId, profileData))
          : resolveIdentity(identifiers, session.tenantId, profileData));

        // Create event/visit node
        const nodeId = isRetail ? `evt_${uuidv4().slice(0, 8)}` : `visit_${uuidv4().slice(0, 8)}`;
        const timestamp = (event.timestamp as string) || new Date().toISOString();
        const relType = isRetail ? "PERFORMED" : "HAD_VISIT";
        const nodeLabel = isRetail ? "Event" : "Visit";
        const idField = isRetail ? "id" : "visit_id";
        const typeField = isRetail ? "event_type" : "type";

        await (trace
          ? trace.run("Graph Write", "runQuery()", "neo4j",
              `creating ${nodeLabel} node for profile ${profileId}`,
              () => runQuery(
                `MATCH (p:Profile {profile_id: $pid, _tenant: $t})
                 CREATE (e:${nodeLabel} {${idField}: $nodeId, ${typeField}: $type, timestamp: datetime($ts),
                   status: $status, amount: $amount, channel: $ch, confidence_score: $conf,
                   properties: $props, _tenant: $t, created_at: datetime()})
                 CREATE (p)-[:${relType}]->(e)`,
                { pid: profileId, t: session.tenantId, nodeId, type: event.event_type as string,
                  ts: timestamp, status: (event.status as string) || "completed",
                  amount: (event.amount as number) || null, ch: (event.channel as string) || "api",
                  conf: (event.confidence_score as number) || 1.0,
                  props: JSON.stringify(event.properties || {}) }
              ))
          : runQuery(
              `MATCH (p:Profile {profile_id: $pid, _tenant: $t})
               CREATE (e:${nodeLabel} {${idField}: $nodeId, ${typeField}: $type, timestamp: datetime($ts),
                 status: $status, amount: $amount, channel: $ch, confidence_score: $conf,
                 properties: $props, _tenant: $t, created_at: datetime()})
               CREATE (p)-[:${relType}]->(e)`,
              { pid: profileId, t: session.tenantId, nodeId, type: event.event_type as string,
                ts: timestamp, status: (event.status as string) || "completed",
                amount: (event.amount as number) || null, ch: (event.channel as string) || "api",
                conf: (event.confidence_score as number) || 1.0,
                props: JSON.stringify(event.properties || {}) }
            ));

        // Commitment extraction
        if (event.event_type === "commitment_made") {
          const props = (event.properties || {}) as Record<string, unknown>;
          await createCommitment(profileId, session.tenantId, {
            promise_text: (props.promise_text as string) || "",
            deadline: (props.deadline as string) || null,
            assignee: (props.assignee as string) || null,
            confidence_score: props.confidence_score as number,
          }, nodeId);
        }

        if (key) processedKeys.add(key);
        processed++;
      } catch (err) {
        console.error("[streams/consume] Error:", err);
        failed++;
      }
    }

    const result = { processed, skipped, failed, total: messages.length, stream: streamInfo };

    return NextResponse.json({
      ...result,
      ...(trace ? { _trace: trace.finalize("event_ingest", `stream consume (${messages.length} messages)`) } : {}),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET — stream status info
export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const info = await getStreamInfo(session.tenantId);
    return NextResponse.json({ stream: info, configured: true });
  } catch (error) {
    return errorResponse(error);
  }
}
