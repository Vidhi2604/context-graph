import { NextRequest, NextResponse } from "next/server";
import { getOrgFromRequest, errorResponse } from "@/lib/api-auth";
import { mapRawPayload } from "@/lib/raw-mapper";
import { normalizePayload } from "@/lib/payload-normalizer";
import { getConfig } from "@/lib/ingest-configs";
import { runQuery } from "@/lib/neo4j";
import { v4 as uuidv4 } from "uuid";

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
        // preview_only — return just the column names
        if (body.preview_only) {
          const rows = parseCSV(csvText);
          const columns = Object.keys(rows[0] || {});
          return NextResponse.json({ columns });
        }
        // Apply column mapping if provided
        if (body.column_mapping) {
          const rows = parseCSV(csvText);
          const remapped = rows.map((row: Record<string, unknown>) => {
            const result = { ...row };
            for (const [ourKey, theirKey] of Object.entries(body.column_mapping as Record<string, string>)) {
              if (theirKey && row[theirKey] !== undefined) result[ourKey] = row[theirKey];
            }
            return result;
          });
          csvText = [Object.keys(remapped[0]).join(","), ...remapped.map((r: Record<string, unknown>) => Object.values(r).map(v => String(v ?? "")).join(","))].join("\n");
        }
      } else if (body.csv_text) {
        csvText = body.csv_text;
      } else {
        return NextResponse.json({ error: "Provide sheet_url or csv_text" }, { status: 400 });
      }
    }

    let rows = parseCSV(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in CSV" }, { status: 400 });
    }

    // Apply column mapping if provided (works for file, text, and sheets)
    let columnMapping: Record<string, string> | null = null;
    if (req.headers.get("content-type")?.includes("multipart")) {
      // Already handled above for file uploads
    } else {
      try {
        const body = await req.clone().json().catch(() => ({}));
        columnMapping = body.column_mapping || null;
      } catch { /* no body */ }
    }

    if (columnMapping) {
      rows = rows.map(row => {
        const result = { ...row };
        for (const [ourKey, theirKey] of Object.entries(columnMapping!)) {
          if (theirKey && row[theirKey] !== undefined) result[ourKey] = row[theirKey];
        }
        return result;
      });
    }

    const config = getConfig(undefined);
    // Run each CSV row through normalizePayload first (alias normalization, nested surfacing)
    // then through mapRawPayload for full identity/event extraction
    const normalizedRows = rows.flatMap(r => normalizePayload(r));
    const mapped = normalizedRows.map(r => mapRawPayload(r, config, "csv")).filter(Boolean).map(e => ({
      ...e,
      _ingest_source: "csv_import",
      confidence_score: 1.0, // CSV imports are trusted — bypass review queue
    }));

    if (mapped.length === 0) {
      return NextResponse.json({
        error: "Could not extract any identifiers from CSV. Make sure columns include email, phone, user_id, or similar.",
        columns_found: Object.keys(rows[0] || {}),
        hint: "Any column name works — we auto-detect email, phone, name and common aliases.",
      }, { status: 422 });
    }

    // Bulk UNWIND write — one query per 500 rows instead of 5 queries per row
    const BULK_SIZE = 500;
    let ingested = 0;
    let failed = 0;

    const bulkRows = mapped.map(e => {
      const identifiers = (e.identifiers || {}) as Record<string, string>;
      const profileData = (e.profile_data || {}) as Record<string, unknown>;
      const props = (e.properties || {}) as Record<string, unknown>;
      const ev = e as unknown as Record<string, unknown>;
      return {
        profileId: `prof_${uuidv4().slice(0, 8)}`,
        eventId: `evt_${uuidv4().slice(0, 8)}`,
        email: identifiers.email || null,
        phone: identifiers.phone || null,
        crmId: identifiers.crm_id || null,
        name: (profileData.name as string) || null,
        tier: (profileData.tier as string) || null,
        city: (profileData.city as string) || null,
        ltv: (profileData.ltv as number) || null,
        eventType: e.event_type || "csv_import",
        timestamp: e.timestamp || new Date().toISOString(),
        amount: (ev.amount as number) || (props.amount as number) || null,
        channel: (ev.channel as string) || (props.channel as string) || null,
        status: (ev.status as string) || (props.status as string) || "completed",
        properties: JSON.stringify(props),
      };
    });

    let lastError: string | null = null;
    for (let i = 0; i < bulkRows.length; i += BULK_SIZE) {
      const batch = bulkRows.slice(i, i + BULK_SIZE);
      try {
        // MERGE profiles by email/phone (dedup), CREATE events in bulk
        await runQuery(
          `UNWIND $batch AS row
           MERGE (p:Profile {
             email: CASE WHEN row.email IS NOT NULL THEN row.email ELSE row.profileId END,
             _tenant: $tenantId
           })
           ON CREATE SET
             p.profile_id = row.profileId,
             p.name       = row.name,
             p.tier       = row.tier,
             p.city       = row.city,
             p.ltv        = row.ltv,
             p.phone      = row.phone,
             p.crm_id     = row.crmId,
             p.created_at = datetime()
           ON MATCH SET
             p.name = COALESCE(row.name, p.name),
             p.tier = COALESCE(row.tier, p.tier),
             p.city = COALESCE(row.city, p.city),
             p.ltv  = COALESCE(row.ltv,  p.ltv)
           CREATE (e:Event {
             id:             row.eventId,
             event_type:     row.eventType,
             timestamp:      datetime(row.timestamp),
             amount:         row.amount,
             channel:        row.channel,
             status:         row.status,
             properties:     row.properties,
             _ingest_source: "csv_import",
             _tenant:        $tenantId,
             created_at:     datetime()
           })
           CREATE (p)-[:PERFORMED]->(e)`,
          { batch, tenantId: session.tenantId }
        );
        ingested += batch.length;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[csv] bulk write error batch ${i}:`, msg);
        lastError = msg;
        failed += batch.length;
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
      ...(lastError ? { ingest_error: lastError } : {}),
    }, { status: 202 });

  } catch (error) {
    return errorResponse(error);
  }
}
