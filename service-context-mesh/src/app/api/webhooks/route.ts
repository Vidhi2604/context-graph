import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const webhooks = await prisma.$queryRawUnsafe(
      `SELECT id, orgId, name, url, condition, enabled, createdAt FROM Webhook WHERE orgId = ? ORDER BY createdAt DESC`,
      session.orgId
    );
    return NextResponse.json({ webhooks });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const { name, url, condition } = await req.json();

    if (!name || !url) {
      return NextResponse.json({ error: "name and url are required" }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `INSERT INTO Webhook (id, orgId, name, url, condition, enabled, createdAt) VALUES (?, ?, ?, ?, ?, 1, ?)`,
      id, session.orgId, name, url, condition || "", now
    );

    const webhook = { id, orgId: session.orgId, name, url, condition: condition || "", enabled: true, createdAt: now };
    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
