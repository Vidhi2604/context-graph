import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse, ApiError } from "@/lib/api-auth";
import { claudeExtract } from "@/lib/llm";
import { PLANS } from "@/lib/plans";
import type { InsightResponse } from "@/types/graph";
import { TraceCollector } from "@/lib/trace";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const traceEnabled = req.nextUrl.searchParams.get("trace") === "true";
    const trace = traceEnabled ? new TraceCollector() : null;

    const session = await (trace
      ? trace.run("Auth & Tenant Resolution", "getOrgFromRequest()", "auth",
          "session cookie / API key",
          () => getOrgFromRequest(req))
      : getOrgFromRequest(req));

    const { success: rlOk } = await checkRateLimit(`insights:${session.tenantId}`, 10, 60);
    if (!rlOk) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const plan = PLANS[session.plan];

    if (plan.insightLevel === "none") {
      throw new ApiError(403, "Upgrade to Pro for AI insights");
    }

    const { query, nodes } = await req.json();

    const graphContext = nodes
      ?.map((n: Record<string, unknown>) =>
        `${n.label}: ${n.displayName} (${JSON.stringify(n.properties).slice(0, 100)})`
      )
      .join("\n") || query || "No context provided";

    const prompt = `You are an analytics expert analyzing a context graph for a ${session.vertical} organization.

Return a JSON object with exactly this structure:
{
  "context": {
    "summary": "1 sentence describing what you're analyzing",
    "data_points": ["specific fact 1", "specific fact 2", ...],
    "graph_scope": "X Nodes, Y Edges"
  },
  "reasoning": [
    { "step": 1, "observation": "what you see", "implication": "what it means", "confidence": 0.0-1.0 },
    { "step": 2, ... }
  ],
  "result": {
    "finding": "main conclusion",
    "recommendation": "what to do about it",
    "confidence": 0.0-1.0,
    "impact": "estimated effect"
  }
}

Rules:
- Be specific with numbers, not vague
- Each reasoning step must reference actual data
- Confidence per step: 0.9+ if data clearly supports, 0.7-0.9 if strongly implied, <0.7 if inferred`;

    // Trace the context assembly step
    await (trace
      ? trace.run("Context Assembly", "assembleContext()", "mapping",
          `${nodes?.length || 0} nodes, vertical: ${session.vertical}`,
          async () => ({ context: graphContext }))
      : Promise.resolve());

    const raw = await (trace
      ? trace.run("LLM Reasoning Chain", "claudeExtract()", "llm",
          `model: llama-3.3-70b, plan: ${session.plan}`,
          () => claudeExtract(prompt, graphContext))
      : claudeExtract(prompt, graphContext)) as Record<string, unknown>;

    // Validate shape — LLM must return an object with a `result` field
    if (!raw || typeof raw !== "object" || !raw.result) {
      return NextResponse.json(
        { error: "Failed to generate insight — LLM returned unexpected format" },
        { status: 502 }
      );
    }

    const result = raw as unknown as InsightResponse;

    // Confidence scoring step
    if (trace) {
      trace.skip("Confidence Aggregation", "aggregateConfidence()", "scoring",
        `overall: ${result.result?.confidence ?? 0}`);
    }

    // Plan gating: Pro gets result only, Enterprise gets full chain
    const response = plan.insightLevel === "summary"
      ? { result: result.result }
      : result;

    return NextResponse.json({
      ...response,
      ...(trace ? { _trace: trace.finalize("insight", query || "analyze") } : {}),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
