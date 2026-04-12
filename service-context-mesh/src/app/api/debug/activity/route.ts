import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { getActivity } from "@/lib/activity-log";

export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const since = req.nextUrl.searchParams.get("since");
    const entries = getActivity(session.tenantId, since ? Number(since) : undefined);
    return NextResponse.json({ entries, ts: Date.now() });
  } catch (error) {
    return errorResponse(error);
  }
}
