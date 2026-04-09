import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse, ApiError } from "@/lib/api-auth";
import { generateJSON } from "@/lib/groq";
import { PLANS } from "@/lib/plans";
import { InsightResponse } from "@/types/graph";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const plan = PLANS[session.plan];

    if (plan.insightLevel === "none") {
      throw new ApiError(403, "Upgrade to Pro for AI insights");
    }

    const { query, nodes } = await req.json();

    const graphContext = nodes
      ?.map((n: Record<string, unknown>) =>
        `${n.label}: ${n.displayName} (${JSON.stringify(n.properties)})`
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
- Confidence per step: 0.9+ if data clearly supports it, 0.7-0.9 if strongly implied, <0.7 if inferred
- Overall confidence = weighted average of reasoning steps`;

    const insight = await generateJSON<InsightResponse>(prompt, graphContext);

    // Plan gating: Pro gets result only, Enterprise gets full chain
    if (plan.insightLevel === "summary") {
      return NextResponse.json({ result: insight.result });
    }

    return NextResponse.json(insight);
  } catch (error) {
    return errorResponse(error);
  }
}
