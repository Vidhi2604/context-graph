import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { consumeFromStream, getStreamInfo } from "@/lib/streams";
import { TraceCollector } from "@/lib/trace";
import { processEventsBatch } from "@/lib/process-events";

export async function POST(req: NextRequest) {
  try {
    const traceEnabled = req.nextUrl.searchParams.get("trace") === "true";
    const trace = traceEnabled ? new TraceCollector() : null;

    const session = await getOrgFromRequest(req);

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

    const { processed, skipped, failed } = await processEventsBatch(
      messages,
      session.tenantId,
      session.orgId,
      session.vertical
    );

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
