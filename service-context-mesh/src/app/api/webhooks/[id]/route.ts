import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getOrgFromRequest(req);
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id FROM Webhook WHERE id = ? AND orgId = ?`,
      params.id, session.orgId
    ) as { id: string }[];

    if (!rows.length) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM Webhook WHERE id = ?`, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
