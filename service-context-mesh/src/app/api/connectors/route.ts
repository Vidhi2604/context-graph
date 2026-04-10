import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { getAdapter, getConnectors, saveConnector, deleteConnector, maskConfig } from "@/lib/connectors/registry";
import { ConnectorTypeSchema } from "@/types/connector";
import { v4 as uuidv4 } from "uuid";

// GET — list connectors for this org (credentials masked)
export async function GET(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const connectors = getConnectors(session.tenantId).map(maskConfig);
    return NextResponse.json({ connectors });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST — create/register a connector
export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const { type, name, credentials } = await req.json();

    const parsed = ConnectorTypeSchema.safeParse(type);
    if (!parsed.success) {
      return NextResponse.json({ error: `Invalid connector type. Must be: hubspot, zendesk, or nurix` }, { status: 400 });
    }

    // Test connection before saving
    const adapter = getAdapter(parsed.data);
    const test = await adapter.testConnection(credentials || {});

    const config = {
      id: `conn_${uuidv4().slice(0, 8)}`,
      type: parsed.data,
      tenantId: session.tenantId,
      name: name || parsed.data,
      credentials: credentials || {},
      active: test.ok,
      created_at: new Date().toISOString(),
    };

    saveConnector(config);

    return NextResponse.json({
      connector: maskConfig(config),
      connection_test: test,
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE — remove a connector
export async function DELETE(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const { connector_id } = await req.json();

    if (!connector_id) {
      return NextResponse.json({ error: "connector_id required" }, { status: 400 });
    }

    const deleted = deleteConnector(session.tenantId, connector_id);
    if (!deleted) {
      return NextResponse.json({ error: "Connector not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
