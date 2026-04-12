"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Tab = "json" | "csv" | "sheets";
type ImportStatus = { mapped: number; ingested: number; skipped: number; columns?: string[] } | null;

const CONNECTORS = [
  {
    id: "hubspot", name: "HubSpot", desc: "CRM contacts, deals, tickets",
    logo: "/logos/hubspot.svg",
    fields: [{ key: "access_token", label: "Private App Token", type: "password" }],
  },
  {
    id: "zendesk", name: "Zendesk", desc: "Support tickets, CSAT",
    logo: "/logos/zendesk.svg",
    fields: [
      { key: "subdomain", label: "Subdomain", type: "text" },
      { key: "email", label: "Admin Email", type: "text" },
      { key: "api_token", label: "API Token", type: "password" },
    ],
  },
  {
    id: "salesforce", name: "Salesforce", desc: "Leads, contacts, cases",
    logo: "/logos/salesforce.svg",
    fields: [
      { key: "access_token", label: "Access Token", type: "password" },
      { key: "instance_url", label: "Instance URL", type: "text" },
    ],
  },
  {
    id: "zoho", name: "Zoho CRM", desc: "Contacts, leads, calls",
    logo: null,
    fields: [
      { key: "access_token", label: "Access Token", type: "password" },
      { key: "org_id", label: "Org ID", type: "text" },
    ],
  },
  {
    id: "nurix", name: "Nurix", desc: "AI voice call transcripts",
    logo: null,
    fields: [
      { key: "api_url", label: "API URL", type: "text" },
      { key: "workspace_id", label: "Workspace ID", type: "password" },
    ],
  },
  {
    id: "mcp", name: "MCP Server", desc: "Any MCP-compatible data source",
    logo: null,
    fields: [
      { key: "server_url", label: "MCP Server URL", type: "text" },
      { key: "api_key", label: "API Key (optional)", type: "password" },
    ],
  },
];

export default function ImportPage() {
  const { data: session } = useSession({ required: true });
  const router = useRouter();
  const orgId = (session as { orgId?: string })?.orgId || "";

  // Connector state
  const [connectedMap, setConnectedMap] = useState<Record<string, string>>({});
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null);
  const [connCreds, setConnCreds] = useState<Record<string, Record<string, string>>>({});
  const [connStatus, setConnStatus] = useState<Record<string, string>>({});
  const [connLoading, setConnLoading] = useState<string | null>(null);

  // Upload state
  const [tab, setTab] = useState<Tab>("csv");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importStatus, setImportStatus] = useState<ImportStatus>(null);

  // Load existing connectors
  useEffect(() => {
    if (!orgId) return;
    fetch("/api/connectors", { headers: { "x-org-id": orgId } })
      .then(r => r.json())
      .then(d => {
        const map: Record<string, string> = {};
        for (const c of d.connectors || []) map[c.type] = c.id;
        setConnectedMap(map);
      })
      .catch(() => {});
  }, [orgId]);

  const handleConnect = async (connId: string) => {
    setConnLoading(connId);
    setConnStatus(p => ({ ...p, [connId]: "" }));
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({ type: connId, name: connId, credentials: connCreds[connId] || {} }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConnStatus(p => ({ ...p, [connId]: data.error || "Connection failed" }));
      } else {
        setConnectedMap(p => ({ ...p, [connId]: data.connector.id }));
        setConnStatus(p => ({ ...p, [connId]: data.connection_test?.detail || "Connected" }));
        setExpandedConnector(null);
      }
    } catch {
      setConnStatus(p => ({ ...p, [connId]: "Something went wrong" }));
    } finally {
      setConnLoading(null);
    }
  };

  const handleSync = async (connId: string) => {
    setConnLoading(connId);
    setConnStatus(p => ({ ...p, [connId]: "Syncing..." }));
    try {
      const dbConnId = connectedMap[connId];
      const body = dbConnId ? { connector_id: dbConnId } : { type: connId };
      const res = await fetch("/api/connectors/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const { events_synced, events_failed } = data.sync_result || {};
        setConnStatus(p => ({ ...p, [connId]: `Synced ${events_synced} events${events_failed ? `, ${events_failed} failed` : ""}` }));
      } else {
        setConnStatus(p => ({ ...p, [connId]: data.error || "Sync failed" }));
      }
    } catch {
      setConnStatus(p => ({ ...p, [connId]: "Sync failed" }));
    } finally {
      setConnLoading(null);
    }
  };

  const handleImport = async () => {
    setImportLoading(true);
    setImportError("");
    setImportStatus(null);
    try {
      let res: Response;
      if (tab === "json") {
        let payload: unknown;
        try { payload = JSON.parse(text); } catch { setImportError("Invalid JSON"); setImportLoading(false); return; }
        res = await fetch("/api/ingest/raw", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-org-id": orgId },
          body: JSON.stringify(Array.isArray(payload) ? payload : [payload]),
        });
      } else if (tab === "csv") {
        if (file) {
          const form = new FormData();
          form.append("file", file);
          res = await fetch("/api/ingest/csv", { method: "POST", headers: { "x-org-id": orgId }, body: form });
        } else {
          res = await fetch("/api/ingest/csv", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-org-id": orgId },
            body: JSON.stringify({ csv_text: text }),
          });
        }
      } else {
        res = await fetch("/api/ingest/csv", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-org-id": orgId },
          body: JSON.stringify({ sheet_url: sheetUrl }),
        });
      }
      const data = await res.json();
      if (!res.ok) setImportError(data.error || "Import failed");
      else setImportStatus({ mapped: data.events_mapped ?? 0, ingested: data.events_ingested ?? 0, skipped: data.events_skipped ?? 0, columns: data.columns_detected });
    } catch { setImportError("Something went wrong"); }
    finally { setImportLoading(false); }
  };

  const canImport = tab === "sheets" ? !!sheetUrl : (!!text.trim() || !!file);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-8 py-4 flex items-center gap-3">
        <button onClick={() => router.push("/dashboard")} className="text-gray-500 hover:text-white text-sm transition-colors">← Dashboard</button>
        <span className="text-gray-700">/</span>
        <h1 className="text-sm font-semibold">Import Data</h1>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-10 space-y-12">
        <div>
          <h2 className="text-2xl font-bold">Get your data in</h2>
          <p className="text-gray-500 mt-1 text-sm">Connect a CRM, upload a file, or paste data directly. We handle the mapping.</p>
        </div>

        {/* ── Section 1: CRM Connectors ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold">Connect a source</h3>
            <span className="text-xs text-gray-600">Pull data automatically via API</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {CONNECTORS.map(c => {
              const isConnected = !!connectedMap[c.id];
              const isExpanded = expandedConnector === c.id;
              const isLoading = connLoading === c.id;
              return (
                <div key={c.id} className={`border rounded-xl p-4 transition-all ${isConnected ? "border-emerald-700 bg-emerald-900/10" : "border-gray-800 bg-gray-900"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {c.logo ? (
                        <Image src={c.logo} alt={c.name} width={24} height={24} className="object-contain" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-gray-700 flex items-center justify-center text-xs font-bold text-white">{c.name[0]}</div>
                      )}
                      <div>
                        <div className="text-sm font-medium">{c.name}</div>
                        <div className="text-[10px] text-gray-500">{c.desc}</div>
                      </div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${isConnected ? "bg-emerald-900/50 text-emerald-400" : "bg-gray-800 text-gray-500"}`}>
                      {isConnected ? "Connected" : "Not connected"}
                    </span>
                  </div>

                  {connStatus[c.id] && (
                    <div className={`text-[10px] mb-2 ${connStatus[c.id].includes("failed") || connStatus[c.id].includes("error") ? "text-red-400" : "text-emerald-400"}`}>
                      {connStatus[c.id]}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="space-y-2 mb-3">
                      {c.fields.map(f => (
                        <input key={f.key} type={f.type} placeholder={f.label}
                          value={connCreds[c.id]?.[f.key] || ""}
                          onChange={e => setConnCreds(p => ({ ...p, [c.id]: { ...p[c.id], [f.key]: e.target.value } }))}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    {!isConnected && !isExpanded && (
                      <button onClick={() => setExpandedConnector(c.id)}
                        className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 py-1.5 rounded-lg transition-colors">
                        Connect
                      </button>
                    )}
                    {isExpanded && (
                      <>
                        <button onClick={() => handleConnect(c.id)} disabled={isLoading}
                          className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-1.5 rounded-lg transition-colors">
                          {isLoading ? "Connecting..." : "Save"}
                        </button>
                        <button onClick={() => setExpandedConnector(null)} className="text-xs text-gray-500 px-2 py-1.5 rounded-lg hover:bg-gray-700">Cancel</button>
                      </>
                    )}
                    {isConnected && (
                      <button onClick={() => handleSync(c.id)} disabled={isLoading}
                        className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 py-1.5 rounded-lg transition-colors">
                        {isLoading ? "Syncing..." : "Sync Now"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-600 font-medium">OR UPLOAD / PASTE DATA</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* ── Section 2: File / Manual Import ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold">Upload or paste data</h3>
            <span className="text-xs text-gray-600">CSV, JSON, or Google Sheets</span>
          </div>

          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
            {([["csv", "CSV"], ["json", "JSON"], ["sheets", "Google Sheets"]] as [Tab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => { setTab(id); setText(""); setFile(null); setSheetUrl(""); setImportError(""); setImportStatus(null); }}
                className={`px-4 py-2 text-sm rounded-lg transition-colors font-medium ${tab === id ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            {tab === "csv" && (
              <>
                <label className="block border-2 border-dashed border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-600 transition-colors">
                  <input type="file" accept=".csv" className="hidden" onChange={e => { setFile(e.target.files?.[0] || null); setText(""); }} />
                  {file ? (
                    <div className="text-emerald-400 text-sm font-medium">{file.name} <span className="text-gray-500 text-xs ml-2">({(file.size / 1024).toFixed(1)} KB)</span></div>
                  ) : (
                    <div className="space-y-1"><div className="text-gray-400 text-sm">Drop a CSV file or click to upload</div><div className="text-gray-600 text-xs">email, phone, name, event_type, amount...</div></div>
                  )}
                </label>
                {!file && (
                  <>
                    <div className="text-xs text-gray-600 text-center">or paste CSV text</div>
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
                      placeholder={"email,name,event,amount\nuser@example.com,Priya,purchase,999"}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 resize-none" />
                  </>
                )}
              </>
            )}

            {tab === "json" && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400">Paste JSON array or single object</label>
                  <button onClick={() => setText(JSON.stringify([{ email: "priya@example.com", event: "purchase", amount: 999, product: "Nike Air Max", city: "Mumbai" }], null, 2))}
                    className="text-xs text-emerald-400 hover:underline">Load example</button>
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={10}
                  placeholder={'[\n  { "email": "user@example.com", "event": "purchase", "amount": 999 }\n]'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 resize-none" />
              </>
            )}

            {tab === "sheets" && (
              <>
                <label className="text-sm text-gray-400 block">Public Google Sheets URL</label>
                <input type="text" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500" />
                <p className="text-xs text-gray-600">Sheet must be set to <span className="text-gray-400">Anyone with the link → Viewer</span>.</p>
              </>
            )}

            {importError && <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">{importError}</div>}

            {importStatus && (
              <div className="bg-emerald-950/30 border border-emerald-800 rounded-xl px-5 py-4 space-y-3">
                <div className="text-emerald-400 font-semibold">Import complete</div>
                <div className="flex gap-6">
                  <div><div className="text-xs text-gray-500">Mapped</div><div className="text-white font-bold text-xl">{importStatus.mapped}</div></div>
                  <div><div className="text-xs text-gray-500">Ingested</div><div className="text-white font-bold text-xl">{importStatus.ingested}</div></div>
                  <div><div className="text-xs text-gray-500">Skipped</div><div className="text-gray-400 font-bold text-xl">{importStatus.skipped}</div></div>
                </div>
                {importStatus.columns && <div className="text-xs text-gray-500">Columns: {importStatus.columns.join(", ")}</div>}
                <button onClick={() => router.push("/dashboard")}
                  className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2 rounded-xl text-sm font-semibold transition-colors">
                  View in Dashboard →
                </button>
              </div>
            )}

            {!importStatus && (
              <button onClick={handleImport} disabled={importLoading || !canImport || !orgId}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 rounded-xl font-semibold transition-colors">
                {importLoading ? "Importing..." : "Import & Build Graph"}
              </button>
            )}
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-1.5">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">What we auto-detect</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500">
              <span>• <span className="text-gray-400">email, phone, user_id</span> — identity</span>
              <span>• <span className="text-gray-400">event, action, type</span> — event type</span>
              <span>• <span className="text-gray-400">amount, price, value</span> — transaction</span>
              <span>• <span className="text-gray-400">name, city, tier</span> — profile</span>
              <span>• <span className="text-gray-400">status, channel</span> — context</span>
              <span>• <span className="text-gray-400">timestamp, date</span> — timeline</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
