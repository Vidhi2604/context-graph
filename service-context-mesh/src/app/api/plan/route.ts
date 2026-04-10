import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-auth";
import { PLANS } from "@/lib/plans";
import { PlanId } from "@/types/org";

export async function PUT(req: NextRequest) {
  try {
    const { orgId, plan } = await req.json();

    if (!orgId || !plan) {
      return NextResponse.json({ error: "orgId and plan required" }, { status: 400 });
    }

    if (!PLANS[plan as PlanId]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const org = await prisma.org.update({
      where: { id: orgId },
      data: { plan },
    });

    return NextResponse.json({
      plan: org.plan,
      features: PLANS[org.plan as PlanId],
    });
  } catch (error) {
    return errorResponse(error);
  }
}
