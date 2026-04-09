import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { OrgSession, PlanId } from "@/types/org";

export async function getOrgFromApiKey(req: NextRequest): Promise<OrgSession> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing API key");
  }
  const apiKey = authHeader.slice(7);
  const org = await prisma.org.findFirst({
    where: { apiKey },
    include: { members: true },
  });
  if (!org) throw new ApiError(401, "Invalid API key");

  return {
    userId: org.members[0]?.userId || "",
    orgId: org.id,
    tenantId: org.tenantId,
    vertical: org.vertical,
    plan: org.plan as PlanId,
  };
}

export async function getOrgFromRequest(req: NextRequest): Promise<OrgSession> {
  // Try API key first (for MCP/SDK/external agents)
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return getOrgFromApiKey(req);
  }

  // Try session cookie (for dashboard)
  const orgId = req.headers.get("x-org-id") || req.cookies.get("orgId")?.value;
  if (!orgId) throw new ApiError(401, "Not authenticated");

  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) throw new ApiError(404, "Org not found");

  return {
    userId: "",
    orgId: org.id,
    tenantId: org.tenantId,
    vertical: org.vertical,
    plan: org.plan as PlanId,
  };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
