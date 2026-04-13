import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { initSchema } from "@/lib/neo4j";
import { getVertical } from "@/verticals/registry";
import { errorResponse } from "@/lib/api-auth";

function generateApiKey(tenantId: string): string {
  const hex = randomBytes(16).toString("hex");
  return `sk_${tenantId}_${hex}`;
}

export async function POST(req: NextRequest) {
  try {
    const { name, vertical, userId } = await req.json();

    if (!name || !vertical) {
      return NextResponse.json(
        { error: "name and vertical required" },
        { status: 400 }
      );
    }

    // Create org with proper API key format
    const tenantId = randomBytes(12).toString("hex");
    const apiKey = generateApiKey(tenantId);

    const org = await prisma.org.create({
      data: { name, vertical, tenantId, apiKey },
    });

    // Add creator as owner — verify user exists first (guards against stale JWT from old DB)
    if (userId) {
      const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (userExists) {
        await prisma.orgMember.create({
          data: { userId, orgId: org.id, role: "owner" },
        });
      }
    }

    // Initialize Neo4j schema for this vertical (non-blocking)
    try {
      const config = getVertical(vertical);
      await initSchema(config.constraints, config.indexes);
    } catch {
      // Non-critical — org is created, schema init can be retried
    }

    return NextResponse.json({
      id: org.id,
      name: org.name,
      vertical: org.vertical,
      tenantId: org.tenantId,
      apiKey: org.apiKey,
      plan: org.plan,
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { orgId, name } = await req.json();
    if (!orgId || !name) {
      return NextResponse.json({ error: "orgId and name required" }, { status: 400 });
    }
    const org = await prisma.org.update({
      where: { id: orgId },
      data: { name },
    });
    return NextResponse.json({ id: org.id, name: org.name });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    const orgId = req.nextUrl.searchParams.get("orgId");

    // Fetch single org by ID (for OrgSwitcher when no userId in session)
    if (orgId) {
      const org = await prisma.org.findUnique({ where: { id: orgId } });
      if (!org) return NextResponse.json({ orgs: [] });
      return NextResponse.json({ orgs: [{ id: org.id, name: org.name, vertical: org.vertical, plan: org.plan }] });
    }

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const memberships = await prisma.orgMember.findMany({
      where: { userId },
      include: { org: true },
    });

    return NextResponse.json({
      orgs: memberships.map((m) => ({
        id: m.org.id,
        name: m.org.name,
        vertical: m.org.vertical,
        plan: m.org.plan,
        role: m.role,
        tenantId: m.org.tenantId,
        apiKey: m.org.apiKey,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
