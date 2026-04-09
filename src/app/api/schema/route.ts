import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { initSchema } from "@/lib/neo4j";
import { getVertical } from "@/verticals/registry";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const config = getVertical(session.vertical);
    await initSchema(config.constraints, config.indexes);
    return NextResponse.json({ success: true, message: "Schema initialized" });
  } catch (error) {
    return errorResponse(error);
  }
}
