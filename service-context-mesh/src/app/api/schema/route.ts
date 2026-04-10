export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { initSchema } from "@/lib/neo4j";
import { getVertical } from "@/verticals/registry";
import { seedRetail } from "@/verticals/retail/seed";
import { seedHealthcare } from "@/verticals/healthcare/seed";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const config = getVertical(session.vertical);
    const seed = req.nextUrl.searchParams.get("seed") === "true";

    // Initialize Neo4j indexes and constraints
    await initSchema(config.constraints, config.indexes);

    let seedResult = null;

    // Seed demo data if requested and not already seeded
    if (seed) {
      const org = await prisma.org.findUnique({ where: { id: session.orgId } });
      if (org && !org.seeded) {
        if (session.vertical === "retail") {
          seedResult = await seedRetail(session.tenantId);
        } else {
          seedResult = await seedHealthcare(session.tenantId);
        }
        await prisma.org.update({
          where: { id: session.orgId },
          data: { seeded: true },
        });
      } else {
        seedResult = { message: "Already seeded" };
      }
    }

    return NextResponse.json({
      success: true,
      message: "Schema initialized",
      seed: seedResult,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
