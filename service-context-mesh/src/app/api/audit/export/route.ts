export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { getAuditLog, exportAuditCSV, auditLog } from "@/lib/audit-log";
import { getPlanFeatures } from "@/lib/plans";

export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const features = getPlanFeatures(session.plan);

    // Audit export is enterprise only
    if (!features.auditExport) {
      return NextResponse.json(
        { error: "Audit export requires Enterprise plan" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json"; // json | csv
    const action = (searchParams.get("action") || undefined) as import("@/lib/audit-log").AuditAction | undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const resource_type = searchParams.get("resource_type") || undefined;
    const limit = parseInt(searchParams.get("limit") || "500", 10);

    const entries = getAuditLog(session.tenantId, { action, from, to, resource_type, limit });

    // Log the export itself
    auditLog({
      tenant_id: session.tenantId,
      action: "export_requested",
      actor: session.userId || "api",
      resource_type: "AuditLog",
      resource_id: session.tenantId,
      metadata: { format, filters: { action, from, to, resource_type }, count: entries.length },
    });

    if (format === "csv") {
      const csv = exportAuditCSV(entries);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-${session.tenantId}-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      tenant_id: session.tenantId,
      exported_at: new Date().toISOString(),
      count: entries.length,
      entries,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
