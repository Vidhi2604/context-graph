export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Switch active org — updates localStorage via response
// Called when user clicks an org in OrgSwitcher
export async function POST(req: NextRequest) {
  try {
    const { orgId } = await req.json();
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const org = await prisma.org.findUnique({ where: { id: orgId } });
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    return NextResponse.json({
      orgId: org.id,
      tenantId: org.tenantId,
      vertical: org.vertical,
      plan: org.plan,
      apiKey: org.apiKey,
      name: org.name,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to switch org" }, { status: 500 });
  }
}
