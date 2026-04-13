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
  const [lsOrgId, setLsOrgId] = useState("");
  const [apiKey, setApiKey] = useState("");
  useEffect(() => {
    setLsOrgId(localStorage.getItem("orgId") || "");
    setApiKey(localStorage.getItem("apiKey") || "");
  }, []);
  const orgId = lsOrgId || (session as { orgId?: string })?.orgId || "";
  const authHeaders: Record<string, string> = apiKey
    ? { "Authorization": `Bearer ${apiKey}` }
    : { "x-org-id": orgId };

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
    fetch("/api/connectors", { headers: { ...authHeaders } })
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
        headers: { "Content-Type": "application/json", ...authHeaders },
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
        headers: { "Content-Type": "application/json", ...authHeaders },
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
        res = await fetch("/api/ingest/raw?sync=true&client=json_import", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(Array.isArray(payload) ? payload : [payload]),
        });
      } else if (tab === "csv") {
        if (file) {
          const form = new FormData();
          form.append("file", file);
          res = await fetch("/api/ingest/csv", { method: "POST", headers: { ...authHeaders }, body: form });
        } else {
          res = await fetch("/api/ingest/csv", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ csv_text: text }),
          });
        }
      } else {
        res = await fetch("/api/ingest/csv", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
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
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="px-8 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <button onClick={() => router.push("/dashboard")} className="text-sm transition-colors hover:opacity-70" style={{ color: "var(--text-muted)" }}>← Dashboard</button>
        <span style={{ color: "var(--border-strong)" }}>/</span>
        <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Import Data</h1>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-10 space-y-12">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Get your data in</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Connect a CRM, upload a file, or paste data directly. We handle the mapping.</p>
        </div>

        {/* ── Section 1: CRM Connectors ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Connect a source</h3>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Pull data automatically via API</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CONNECTORS.map(c => {
              const isConnected = !!connectedMap[c.id];
              const isExpanded = expandedConnector === c.id;
              const isLoading = connLoading === c.id;
              return (
                <div key={c.id} className="rounded-xl p-4 transition-all theme-card"
                  style={isConnected ? { borderColor: "#10b981", background: "rgba(16,185,129,0.05)" } : {}}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {c.logo ? (
                        <Image src={c.logo} alt={c.name} width={24} height={24} className="object-contain" />
                      ) : (
                        <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white bg-emerald-600">{c.name[0]}</div>
                      )}
                      <div>
                        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{c.desc}</div>
                      </div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${isConnected ? "bg-emerald-900/50 text-emerald-400" : ""}`}
                      style={!isConnected ? { background: "var(--bg-surface-2)", color: "var(--text-muted)" } : {}}>
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
                          className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none theme-input"
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    {!isConnected && !isExpanded && (
                      <button onClick={() => setExpandedConnector(c.id)}
                        className="flex-1 text-xs py-1.5 rounded-lg transition-colors"
                        style={{ background: "var(--bg-surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        Connect
                      </button>
                    )}
                    {isExpanded && (
                      <>
                        <button onClick={() => handleConnect(c.id)} disabled={isLoading}
                          className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-1.5 rounded-lg transition-colors text-white">
                          {isLoading ? "Connecting..." : "Save"}
                        </button>
                        <button onClick={() => setExpandedConnector(null)}
                          className="text-xs px-2 py-1.5 rounded-lg transition-colors"
                          style={{ color: "var(--text-muted)" }}>Cancel</button>
                      </>
                    )}
                    {isConnected && (
                      <button onClick={() => handleSync(c.id)} disabled={isLoading}
                        className="flex-1 text-xs py-1.5 rounded-lg transition-colors"
                        style={{ background: "var(--bg-surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
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
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>or upload / paste data</span>
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        </div>

        {/* ── Section 2: File / Manual Import ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Upload or paste data</h3>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>CSV, JSON, or Google Sheets</span>
          </div>

          <div className="flex gap-1 rounded-xl p-1 w-fit theme-card">
            {([["csv", "CSV"], ["json", "JSON"], ["sheets", "Google Sheets"]] as [Tab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => { setTab(id); setText(""); setFile(null); setSheetUrl(""); setImportError(""); setImportStatus(null); }}
                className="px-4 py-2 text-sm rounded-lg transition-colors font-medium"
                style={tab === id
                  ? { background: "var(--bg-surface-2)", color: "var(--text-primary)" }
                  : { color: "var(--text-muted)" }}>
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl p-6 space-y-4 theme-card">
            {tab === "csv" && (
              <>
                <label className="block rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-emerald-500"
                  style={{ border: "2px dashed var(--border-strong)" }}>
                  <input type="file" accept=".csv" className="hidden" onChange={e => { setFile(e.target.files?.[0] || null); setText(""); }} />
                  {file ? (
                    <div className="text-emerald-500 text-sm font-medium">{file.name} <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>({(file.size / 1024).toFixed(1)} KB)</span></div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Drop a CSV file or click to upload</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>email, phone, name, event_type, amount...</div>
                    </div>
                  )}
                </label>
                {!file && (
                  <>
                    <div className="text-xs text-center" style={{ color: "var(--text-muted)" }}>or paste CSV text</div>
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
                      placeholder={"email,name,event,amount\nuser@example.com,Priya,purchase,999"}
                      className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none theme-input" />
                  </>
                )}
              </>
            )}

            {tab === "json" && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-sm" style={{ color: "var(--text-secondary)" }}>Paste JSON array or single object</label>
                  <button onClick={() => setText(JSON.stringify([{ email: "priya@example.com", event: "purchase", amount: 999, product: "Nike Air Max", city: "Mumbai" }], null, 2))}
                    className="text-xs text-emerald-500 hover:underline">Load example</button>
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={10}
                  placeholder={'[\n  { "email": "user@example.com", "event": "purchase", "amount": 999 }\n]'}
                  className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none theme-input" />
              </>
            )}

            {tab === "sheets" && (
              <>
                <label className="text-sm block mb-2" style={{ color: "var(--text-secondary)" }}>Public Google Sheets URL</label>
                <input type="text" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none theme-input" />
                <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Sheet must be set to <span style={{ color: "var(--text-secondary)" }}>Anyone with the link → Viewer</span>.</p>
              </>
            )}

            {importError && (
              <div className="rounded-lg px-4 py-3 text-red-400 text-sm" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)" }}>
                {importError}
              </div>
            )}

            {importStatus && (
              <div className="rounded-xl px-5 py-4 space-y-3" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.3)" }}>
                <div className="text-emerald-500 font-semibold">Import complete</div>
                <div className="flex gap-6">
                  <div><div className="text-xs" style={{ color: "var(--text-muted)" }}>Mapped</div><div className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>{importStatus.mapped}</div></div>
                  <div><div className="text-xs" style={{ color: "var(--text-muted)" }}>Ingested</div><div className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>{importStatus.ingested}</div></div>
                  <div><div className="text-xs" style={{ color: "var(--text-muted)" }}>Skipped</div><div className="font-bold text-xl" style={{ color: "var(--text-muted)" }}>{importStatus.skipped}</div></div>
                </div>
                {importStatus.columns && <div className="text-xs" style={{ color: "var(--text-muted)" }}>Columns: {importStatus.columns.join(", ")}</div>}
                <button onClick={() => router.push("/dashboard")}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors">
                  View in Dashboard →
                </button>
              </div>
            )}

            {!importStatus && (
              <button onClick={handleImport} disabled={importLoading || !canImport || (!orgId && !apiKey)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 rounded-xl font-semibold transition-colors text-white">
                {importLoading ? "Importing..." : "Import & Build Graph"}
              </button>
            )}
          </div>

          <div className="rounded-xl p-4 space-y-1.5 theme-card">
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>What we auto-detect</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
              <span>• <span style={{ color: "var(--text-secondary)" }}>email, phone, user_id</span> — identity</span>
              <span>• <span style={{ color: "var(--text-secondary)" }}>event, action, type</span> — event type</span>
              <span>• <span style={{ color: "var(--text-secondary)" }}>amount, price, value</span> — transaction</span>
              <span>• <span style={{ color: "var(--text-secondary)" }}>name, city, tier</span> — profile</span>
              <span>• <span style={{ color: "var(--text-secondary)" }}>status, channel</span> — context</span>
              <span>• <span style={{ color: "var(--text-secondary)" }}>timestamp, date</span> — timeline</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
