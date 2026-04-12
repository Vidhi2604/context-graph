import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { mapRawPayload } from "@/lib/raw-mapper";
import { getConfig } from "@/lib/ingest-configs";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Handle quoted values with commas inside
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }

  return rows;
}

async function fetchGoogleSheet(url: string): Promise<string> {
  // Convert Google Sheets URL to CSV export URL
  let csvUrl = url;

  if (url.includes("docs.google.com/spreadsheets")) {
    // Extract sheet ID
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) throw new Error("Invalid Google Sheets URL");
    const sheetId = match[1];

    // Get gid if present
    const gidMatch = url.match(/gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";

    csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }

  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status}. Make sure the sheet is publicly accessible.`);
  return res.text();
}

export async function POST(req: NextRequest) {
  try {
    const session = await getOrgFromRequest(req);
    const contentType = req.headers.get("content-type") || "";

    let csvText = "";

    if (contentType.includes("multipart/form-data")) {
      // File upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const sheetUrl = formData.get("sheet_url") as string | null;

      if (sheetUrl) {
        csvText = await fetchGoogleSheet(sheetUrl);
      } else if (file) {
        csvText = await file.text();
      } else {
        return NextResponse.json({ error: "Provide a CSV file or Google Sheets URL" }, { status: 400 });
      }
    } else {
      const body = await req.json();
      if (body.sheet_url) {
        csvText = await fetchGoogleSheet(body.sheet_url);
      } else if (body.csv_text) {
        csvText = body.csv_text;
      } else {
        return NextResponse.json({ error: "Provide sheet_url or csv_text" }, { status: 400 });
      }
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in CSV" }, { status: 400 });
    }

    const config = getConfig(undefined);
    const mapped = rows.map(r => mapRawPayload(r, config, "csv")).filter(Boolean);

    if (mapped.length === 0) {
      return NextResponse.json({
        error: "Could not extract any identifiers from CSV. Make sure columns include email, phone, user_id, or similar.",
        columns_found: Object.keys(rows[0] || {}),
        hint: "Rename your columns to: email, phone, name, event_type, amount, status",
      }, { status: 422 });
    }

    // Process events
    const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    let ingested = 0;
    let failed = 0;

    for (const event of mapped) {
      try {
        const res = await fetch(`${baseUrl}/api/events/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-org-id": session.orgId,
            "x-cron-secret": process.env.CRON_SECRET || "dev",
          },
          body: JSON.stringify({
            events: [{ ...event, _vertical: session.vertical }],
            tenantId: session.tenantId,
          }),
        });
        if (res.ok) ingested++;
        else failed++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({
      accepted: true,
      total_rows: rows.length,
      events_mapped: mapped.length,
      events_ingested: ingested,
      events_failed: failed,
      skipped: rows.length - mapped.length,
      columns_detected: Object.keys(rows[0] || {}),
    }, { status: 202 });

  } catch (error) {
    return errorResponse(error);
  }
}
