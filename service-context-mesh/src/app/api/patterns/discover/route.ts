export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse, ApiError } from "@/lib/api-auth";
import { runPatternDiscovery } from "@/lib/pattern-discovery";
import { PLANS } from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const plan = PLANS[session.plan];

    if (plan.insightLevel !== "full") {
      throw new ApiError(403, "Pattern discovery requires Enterprise plan");
    }

    const patterns = await runPatternDiscovery(session.tenantId, session.vertical);

    if (patterns.length === 0) {
      return NextResponse.json({ patterns: [], message: "No patterns found with current data" });
    }

    return NextResponse.json({ patterns });
  } catch (error) {
    return errorResponse(error);
  }
}
