import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { getAllAlerts } from "@/lib/alert-engine";

export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const alerts = await getAllAlerts(session.tenantId, session.vertical);
    return NextResponse.json({ alerts });
  } catch (error) {
    return errorResponse(error);
  }
}
