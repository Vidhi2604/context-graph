"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Logo from "@/components/Logo";


export default function SettingsPage() {
  const { data: session } = useSession();
  const [orgName, setOrgName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [lsOrgId, setLsOrgId] = useState("");
  const [lsVertical, setLsVertical] = useState("retail");
  useEffect(() => {
    setLsOrgId(localStorage.getItem("orgId") || "");
    setLsVertical(localStorage.getItem("vertical") || "retail");
  }, []);
  const orgId = session?.orgId || lsOrgId || "";
  const vertical = session?.vertical || lsVertical || "retail";

  useEffect(() => {
    const lsOrgId = typeof window !== "undefined" ? localStorage.getItem("orgId") : "";
    const activeOrgId = session?.orgId || lsOrgId || "";
    const userId = (session?.user as { id?: string })?.id || (typeof window !== "undefined" ? localStorage.getItem("userId") : "") || "";

    if (!userId && !activeOrgId) return;

    const url = userId ? `/api/org?userId=${userId}` : `/api/org?orgId=${activeOrgId}`;
    fetch(url, { headers: activeOrgId ? { "x-org-id": activeOrgId } : {} })
      .then((r) => r.json())
      .then((data) => {
        const org = data.orgs?.find((o: { id: string }) => o.id === activeOrgId) || data.orgs?.[0];
        if (org) {
          setOrgName(org.name || "");

          setApiKey(org.apiKey || "");
          // Sync localStorage if it was missing
          if (typeof window !== "undefined" && !lsOrgId) {
            localStorage.setItem("orgId", org.id);
            localStorage.setItem("vertical", org.vertical || "retail");
          }
        }
      })
      .catch(() => {});
  }, [session]);

  const handleSaveOrg = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, name: orgName }),
      });
      if (typeof window !== "undefined") localStorage.setItem("orgName", orgName);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };


  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Logo size={32} />
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400 text-sm">Settings</span>
          </div>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-white transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Organization */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-base font-semibold mb-4">Organization</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm text-gray-400 block mb-1.5">Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm text-gray-400 block mb-1.5">Vertical</label>
                <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-300">
                  <span suppressHydrationWarning>{vertical === "retail" ? "🏪" : "🏥"}</span>
                  {vertical.charAt(0).toUpperCase() + vertical.slice(1)}
                  <span className="text-gray-600 text-xs ml-1">· locked after creation</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleSaveOrg}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : saved ? "✓ Saved" : "Save Changes"}
            </button>
          </div>
        </section>

        {/* Access Keys */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-base font-semibold mb-1">Access Keys</h2>
          <p className="text-xs text-gray-500 mb-4">Use these to authenticate API, MCP, and SDK requests. Keep them secret.</p>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Org ID</label>
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-400 font-mono truncate">
                {orgId || "—"}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">API Key</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-300 truncate">
                  {apiKey
                    ? apiKeyVisible ? apiKey : `sk_${"•".repeat(24)}${apiKey.slice(-4)}`
                    : "No API key generated"}
                </div>
                <button onClick={() => setApiKeyVisible(!apiKeyVisible)}
                  className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                  {apiKeyVisible ? "Hide" : "Show"}
                </button>
                <button onClick={handleCopyKey} disabled={!apiKey}
                  className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40 px-3 py-2.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </section>


        {/* Connectors — Pull data IN */}
        <ConnectorsSection orgId={orgId} />

        {/* CSV / Google Sheets Import */}
        <CSVImportSection orgId={orgId} vertical={vertical} />

        {/* Webhooks */}
        <WebhooksSection orgId={orgId} />

        {/* MCP / API Access */}
        <MCPAccessSection orgId={orgId} apiKey={apiKey} />

      </main>
    </div>
  );
}

// ── Connector definitions ────────────────────────────────────────

const CONNECTOR_ICONS: Record<string, React.ReactNode> = {
  hubspot: (
    <svg width="28" height="28" viewBox="333 0 179 149" xmlns="http://www.w3.org/2000/svg">
      <path d="M461.278 69.831c-3.256-5.602-7.836-10.093-13.562-13.474-4.279-2.491-8.716-4.072-13.716-4.751v-17.8c5-2.123 8.103-6.822 8.103-12.304 0-7.472-5.992-13.527-13.458-13.527-7.472 0-13.569 6.055-13.569 13.527 0 5.482 2.924 10.181 7.924 12.304v17.808c-4 .578-8.148 1.825-11.936 3.741-7.737-5.876-33.107-25.153-47.948-36.412.352-1.269.623-2.577.623-3.957 0-8.276-6.702-14.984-14.981-14.984S333.78 6.71 333.78 14.986c0 8.275 6.706 14.985 14.985 14.985 2.824 0 5.436-.826 7.69-2.184l3.132 2.376 43.036 31.008c-2.275 2.089-4.394 4.465-6.089 7.131C393.099 73.737 391 79.717 391 86.24v1.361c0 4.579.87 8.902 2.352 12.963 1.305 3.546 3.213 6.77 5.576 9.685l-14.283 14.318a11.501 11.501 0 0 0-12.166 2.668 11.499 11.499 0 0 0-3.388 8.19c.001 3.093 1.206 6 3.394 8.187a11.5 11.5 0 0 0 8.188 3.394 11.51 11.51 0 0 0 8.191-3.394 11.514 11.514 0 0 0 3.39-8.187c0-1.197-.185-2.365-.533-3.475l14.763-14.765c2.024 1.398 4.21 2.575 6.56 3.59 4.635 2.004 9.751 3.225 15.35 3.225h1.026c6.19 0 12.029-1.454 17.518-4.428 5.784-3.143 10.311-7.441 13.731-12.928 3.438-5.502 5.331-11.581 5.331-18.269v-.334c0-6.579-1.523-12.649-4.722-18.21zm-18.038 30.973c-4.007 4.453-8.613 7.196-13.82 7.196h-.858c-2.974 0-5.883-.822-8.731-2.317-3.21-1.646-5.65-3.994-7.647-6.967-2.064-2.918-3.184-6.104-3.184-9.482v-1.026c0-3.321.637-6.47 2.243-9.444 1.717-3.251 4.036-5.779 7.12-7.789 3.028-1.996 6.262-2.975 9.864-2.975h.335c3.266 0 6.358.644 9.276 2.137 2.973 1.592 5.402 3.767 7.285 6.628 1.829 2.862 2.917 5.949 3.267 9.312.055.699.083 1.415.083 2.099 0 4.564-1.744 8.791-5.233 12.628z" fill="#F8761F"/>
    </svg>
  ),
  zendesk: (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logos/zendesk.svg" alt="Zendesk" className="w-7 h-7 object-contain" />
  ),
  salesforce: (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logos/salesforce.svg" alt="Salesforce" className="w-7 h-7 object-contain" />
  ),
  zoho: (
    <svg viewBox="0 0 120 55" className="w-10 h-6">
      <rect x="2" y="2" width="30" height="30" rx="6" fill="none" stroke="#e42527" strokeWidth="5"/>
      <rect x="22" y="12" width="30" height="30" rx="6" fill="none" stroke="#179c3d" strokeWidth="5"/>
      <rect x="42" y="2" width="30" height="30" rx="6" fill="none" stroke="#2b6cb0" strokeWidth="5"/>
      <rect x="62" y="12" width="30" height="30" rx="6" fill="none" stroke="#e8a020" strokeWidth="5"/>
    </svg>
  ),
  nurix: (
    <svg viewBox="0 0 100 100" className="w-7 h-7">
      {/* Blue left stroke of X (top-left to bottom-right) */}
      <polygon points="5,5 35,5 95,95 65,95" fill="#4d6ef5"/>
      {/* Dark navy right stroke of X (top-right to bottom-left) */}
      <polygon points="65,5 95,5 35,95 5,95" fill="#0f1f5c"/>
    </svg>
  ),
  mcp: (
    <div className="w-7 h-7 rounded-lg bg-violet-900/50 border border-violet-700 flex items-center justify-center text-violet-400 text-xs font-bold">
      MCP
    </div>
  ),
  custom: (
    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#9ca3af">
        <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.3.07-.62.07-.96s-.03-.67-.07-1l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.58-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.96l-2.11 1.66c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z"/>
      </svg>
    </div>
  ),
};

const CONNECTORS = [
  { id: "hubspot",    name: "HubSpot",    desc: "CRM contacts, deals, tickets",          credFields: [{ key: "access_token", label: "Private App Token", type: "password" }] },
  { id: "zendesk",   name: "Zendesk",    desc: "Support tickets, CSAT, escalations",     credFields: [{ key: "subdomain", label: "Subdomain", type: "text" }, { key: "email", label: "Admin Email", type: "text" }, { key: "api_token", label: "API Token", type: "password" }] },
  { id: "salesforce",name: "Salesforce", desc: "Leads, contacts, cases, opportunities",  credFields: [{ key: "access_token", label: "Access Token", type: "password" }, { key: "instance_url", label: "Instance URL", type: "text" }] },
  { id: "zoho",      name: "Zoho CRM",   desc: "Contacts, leads, calls",                 credFields: [{ key: "access_token", label: "Access Token", type: "password" }, { key: "org_id", label: "Org ID", type: "text" }] },
  { id: "nurix",     name: "Nurix",      desc: "AI voice call transcripts",              credFields: [{ key: "api_url", label: "API URL", type: "text" }, { key: "workspace_id", label: "Workspace ID", type: "password" }] },
  { id: "mcp",       name: "MCP Server", desc: "Any MCP-compatible data source",         credFields: [{ key: "server_url", label: "MCP Server URL", type: "text" }, { key: "api_key", label: "API Key (optional)", type: "password" }] },
  { id: "custom",    name: "Custom",     desc: "Any system via REST API",                credFields: [{ key: "api_url", label: "API URL", type: "text" }, { key: "api_key", label: "API Key", type: "password" }] },
];


// ── Connectors Section (GET — pull data IN) ──────────────────────

function ConnectorsSection({ orgId }: { orgId: string }) {
  const [showMore, setShowMore] = useState(false);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [connectorIds, setConnectorIds] = useState<Record<string, string>>({});
  const [expanding, setExpanding] = useState<string | null>(null);
  const [creds, setCreds] = useState<Record<string, Record<string, string>>>({});
  const [syncing, setSyncing] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});

  // Load existing connectors
  useEffect(() => {
    if (!orgId) return;
    fetch("/api/connectors", { headers: { "x-org-id": orgId } })
      .then(r => r.json())
      .then(data => {
        const conn: Record<string, boolean> = {};
        const ids: Record<string, string> = {};
        for (const c of data.connectors || []) { conn[c.type] = true; ids[c.type] = c.id; }
        setConnected(conn);
        setConnectorIds(ids);
      })
      .catch(() => {});
  }, [orgId]);

  const handleConnect = async (connId: string) => {
    const c = CONNECTORS.find(c => c.id === connId);
    if (!c) return;
    const credentials = creds[connId] || {};
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({ type: connId, name: c.name, credentials }),
      });
      const data = await res.json();
      if (res.ok) {
        setConnected(p => ({ ...p, [connId]: true }));
        setConnectorIds(p => ({ ...p, [connId]: data.connector?.id || "" }));
        setStatus(p => ({ ...p, [connId]: data.connection_test?.detail || "Connected" }));
        setExpanding(null);
      } else {
        setStatus(p => ({ ...p, [connId]: data.error || "Failed" }));
      }
    } catch {
      setStatus(p => ({ ...p, [connId]: "Connection failed" }));
    }
  };

  const handleDisconnect = async (connId: string) => {
    const dbConnectorId = connectorIds[connId];
    if (!dbConnectorId) return;
    try {
      await fetch("/api/connectors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({ connector_id: dbConnectorId }),
      });
      setConnected(p => ({ ...p, [connId]: false }));
      setConnectorIds(p => { const n = { ...p }; delete n[connId]; return n; });
      setStatus(p => ({ ...p, [connId]: "" }));
    } catch {
      setStatus(p => ({ ...p, [connId]: "Disconnect failed" }));
    }
  };

  const handleSync = async (connId: string) => {
    setSyncing(connId);
    setStatus(p => ({ ...p, [connId]: "Syncing... (may take 30s)" }));
    try {
      const dbConnectorId = connectorIds[connId];
      const body = dbConnectorId ? { connector_id: dbConnectorId } : { type: connId };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout
      const res = await fetch("/api/connectors/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      setStatus(p => ({ ...p, [connId]: `✓ Synced ${data.sync_result?.events_synced || 0} events` }));
    } catch (e) {
      const msg = e instanceof Error && e.name === "AbortError" ? "Sync timed out — data may still be processing" : "Sync failed";
      setStatus(p => ({ ...p, [connId]: msg }));
    } finally {
      setSyncing(null);
    }
  };

  const visibleConnectors = showMore ? CONNECTORS : CONNECTORS.slice(0, 3);

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold">Connectors</h2>
        <span className="text-xs text-gray-500">{CONNECTORS.filter(c => connected[c.id]).length} connected</span>
      </div>
      <p className="text-xs text-gray-500 mb-5">Pull data IN from external systems. Events flow into the context graph automatically.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibleConnectors.map(c => {
          const isConn = connected[c.id];
          const isOpen = expanding === c.id;
          return (
            <div key={c.id} className={`border rounded-xl p-4 transition-all ${isConn ? "border-emerald-700 bg-emerald-900/10" : "border-gray-800 bg-gray-800/50"}`}
              style={{ animation: "fadeSlideIn 0.3s ease both" }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="shrink-0">{CONNECTOR_ICONS[c.id]}</span>
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-[10px] text-gray-500">{c.desc}</div>
                  </div>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${isConn ? "bg-emerald-900/50 text-emerald-400" : "bg-gray-700 text-gray-500"}`}>
                  {isConn ? "Connected" : "Not connected"}
                </span>
              </div>
              {status[c.id] && <div className="text-[10px] text-gray-500 mb-2">{status[c.id]}</div>}
              {isOpen && (
                <div className="space-y-2 mb-3">
                  {c.credFields.map(f => (
                    <input
                      key={f.key}
                      type={f.type}
                      placeholder={f.label}
                      value={creds[c.id]?.[f.key] || ""}
                      onChange={e => setCreds(p => ({ ...p, [c.id]: { ...p[c.id], [f.key]: e.target.value } }))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                {!isConn && !isOpen && (
                  <button onClick={() => setExpanding(c.id)} className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 py-1.5 rounded-lg transition-colors">
                    Connect
                  </button>
                )}
                {isOpen && (
                  <>
                    <button onClick={() => handleConnect(c.id)} className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-500 py-1.5 rounded-lg transition-colors">
                      Save
                    </button>
                    <button onClick={() => setExpanding(null)} className="text-xs text-gray-500 px-2 py-1.5 rounded-lg hover:bg-gray-700">
                      Cancel
                    </button>
                  </>
                )}
                {isConn && (
                  <>
                    <button
                      onClick={() => handleSync(c.id)}
                      disabled={syncing === c.id}
                      className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 py-1.5 rounded-lg transition-colors"
                    >
                      {syncing === c.id ? "Syncing..." : "Sync Now"}
                    </button>
                    <button
                      onClick={() => handleDisconnect(c.id)}
                      className="text-xs text-red-400 hover:bg-red-900/20 px-2 py-1.5 rounded-lg transition-colors border border-red-900/30"
                    >
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes fadeSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes chevronBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
      `}</style>
      {CONNECTORS.length > 3 && (
        <button onClick={() => setShowMore(!showMore)}
          className="mt-2 flex flex-col items-center gap-0 mx-auto opacity-40 hover:opacity-80 transition-opacity">
          {showMore ? (
            <>
              <span className="text-[10px]" style={{ color:"var(--text-muted)", lineHeight:1 }}>›› rotated</span>
              <svg width="24" height="14" viewBox="0 0 24 14" style={{ transform:"rotate(180deg)" }}>
                <polyline points="4,10 12,4 20,10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:"var(--text-muted)" }}/>
              </svg>
              <svg width="24" height="14" viewBox="0 0 24 14" style={{ transform:"rotate(180deg)", marginTop:-6 }}>
                <polyline points="4,10 12,4 20,10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:"var(--text-muted)", opacity:0.5 }}/>
              </svg>
            </>
          ) : (
            <div style={{ animation:"chevronBounce 1.4s ease-in-out infinite" }}>
              <svg width="24" height="14" viewBox="0 0 24 14">
                <polyline points="4,4 12,10 20,4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:"var(--text-muted)" }}/>
              </svg>
              <svg width="24" height="14" viewBox="0 0 24 14" style={{ marginTop:-6 }}>
                <polyline points="4,4 12,10 20,4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:"var(--text-muted)", opacity:0.5 }}/>
              </svg>
            </div>
          )}
        </button>
      )}
    </section>
  );
}

// ── Import Data Section ───────────────────────────────────────────

type ImportTab = "json" | "csv" | "sheets";

const COMMON_FIELDS = [
  { key: "email",      label: "Email",       required: true  },
  { key: "name",       label: "Name",        required: false },
  { key: "phone",      label: "Phone",       required: false },
  { key: "event_type", label: "Event Type",  required: false },
  { key: "status",     label: "Status",      required: false },
  { key: "timestamp",  label: "Timestamp",   required: false },
  { key: "channel",    label: "Channel",     required: false },
];

const VERTICAL_FIELDS: Record<string, { key: string; label: string; required: boolean }[]> = {
  retail: [
    { key: "amount",        label: "Order Amount",    required: false },
    { key: "order_id",      label: "Order ID",        required: false },
    { key: "product_name",  label: "Product Name",    required: false },
    { key: "category",      label: "Category",        required: false },
    { key: "brand",         label: "Brand",           required: false },
    { key: "location",      label: "Location / City", required: false },
  ],
  healthcare: [
    { key: "patient_id",    label: "Patient ID",      required: false },
    { key: "mrn",           label: "MRN",             required: false },
    { key: "department",    label: "Department",      required: false },
    { key: "doctor_name",   label: "Doctor Name",     required: false },
    { key: "diagnosis",     label: "Diagnosis",       required: false },
    { key: "severity",      label: "Severity",        required: false },
    { key: "visit_type",    label: "Visit Type",      required: false },
    { key: "age",           label: "Age",             required: false },
    { key: "gender",        label: "Gender",          required: false },
  ],
  cx: [
    { key: "ticket_id",     label: "Ticket ID",       required: false },
    { key: "agent_name",    label: "Agent Name",      required: false },
    { key: "sentiment",     label: "Sentiment",       required: false },
    { key: "resolution",    label: "Resolution",      required: false },
    { key: "duration",      label: "Duration",        required: false },
    { key: "amount",        label: "Amount",          required: false },
  ],
};

function extractKeys(data: unknown, depth = 0): string[] {
  if (depth > 3) return [];
  if (Array.isArray(data) && data.length > 0) return extractKeys(data[0], depth);
  if (data && typeof data === "object") {
    const keys: string[] = [];
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      keys.push(k);
      if (v && typeof v === "object" && !Array.isArray(v)) {
        extractKeys(v, depth + 1).forEach(sk => keys.push(`${k}.${sk}`));
      }
    }
    return Array.from(new Set(keys));
  }
  return [];
}

function applyMapping(data: unknown, mapping: Record<string, string>): unknown {
  const remap = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = { ...obj };
    for (const [ourKey, theirKey] of Object.entries(mapping)) {
      if (!theirKey) continue;
      // Support dot notation: "personal.contact.email"
      const parts = theirKey.split(".");
      let val: unknown = obj;
      for (const part of parts) {
        val = (val as Record<string, unknown>)?.[part];
      }
      if (val !== undefined) result[ourKey] = val;
    }
    return result;
  };
  if (Array.isArray(data)) return data.map(item => remap(item as Record<string, unknown>));
  if (data && typeof data === "object") return remap(data as Record<string, unknown>);
  return data;
}

function CSVImportSection({ orgId, vertical = "retail" }: { orgId: string; vertical?: string }) {
  const ourFields = [...COMMON_FIELDS, ...(VERTICAL_FIELDS[vertical] || VERTICAL_FIELDS.retail)];
  const [tab, setTab] = useState<ImportTab>("csv");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [detectedKeys, setDetectedKeys] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [showMapping, setShowMapping] = useState(false);

  const reset = () => {
    setText(""); setFile(null); setSheetUrl(""); setError(""); setResult(null);
    setDetectedKeys([]); setMapping({}); setShowMapping(false);
  };

  // Auto-detect keys when JSON text changes
  const handleTextChange = (val: string) => {
    setText(val);
    if (tab === "json" && val.trim()) {
      try {
        const parsed = JSON.parse(val);
        const keys = extractKeys(parsed);
        setDetectedKeys(keys);
        // Auto-map exact matches
        const autoMap: Record<string, string> = {};
        for (const field of ourFields) {
          const match = keys.find(k => k.toLowerCase() === field.key || k.toLowerCase().endsWith(`.${field.key}`));
          if (match) autoMap[field.key] = match;
        }
        setMapping(autoMap);
        setShowMapping(keys.length > 0);
      } catch { setDetectedKeys([]); setShowMapping(false); }
    }
  };

  const handleImport = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      let res: Response;
      if (tab === "json") {
        let payload: unknown;
        try { payload = JSON.parse(text); } catch { setError("Invalid JSON"); setLoading(false); return; }
        // Apply field mapping if user configured it
        const hasMappings = Object.values(mapping).some(v => v);
        if (hasMappings) payload = applyMapping(payload, mapping);
        res = await fetch("/api/ingest/raw", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-org-id": orgId },
          body: JSON.stringify(payload),
        });
      } else if (tab === "csv") {
        const hasMappings = Object.values(mapping).some(v => v);
        if (file) {
          const form = new FormData();
          form.append("file", file);
          if (hasMappings) form.append("column_mapping", JSON.stringify(mapping));
          res = await fetch("/api/ingest/csv", { method: "POST", headers: { "x-org-id": orgId }, body: form });
        } else {
          res = await fetch("/api/ingest/csv", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-org-id": orgId },
            body: JSON.stringify({ csv_text: text, column_mapping: hasMappings ? mapping : undefined }),
          });
        }
      } else {
        const hasMappings = Object.values(mapping).some(v => v);
        res = await fetch("/api/ingest/csv", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-org-id": orgId },
          body: JSON.stringify({ sheet_url: sheetUrl, column_mapping: hasMappings ? mapping : undefined }),
        });
      }
      const data = await res.json();
      if (!res.ok) setError(data.error || "Import failed");
      else setResult(data);
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  };

  const canImport = tab === "sheets" ? !!sheetUrl : (!!text.trim() || !!file);

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-base font-semibold mb-1">Import Data</h2>
      <p className="text-sm text-gray-400 mb-5">Upload CSV, paste JSON, or connect a Google Sheet — we map and ingest it automatically.</p>

      <div className="flex gap-1 bg-gray-800 rounded-xl p-1 w-fit mb-4">
        {([["csv", "CSV"], ["json", "JSON"], ["sheets", "Google Sheets"]] as [ImportTab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); reset(); }}
            className={`px-4 py-1.5 text-sm rounded-lg transition-colors font-medium ${tab === id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "csv" && (
        <div className="space-y-3">
          <label className="block border-2 border-dashed border-gray-700 rounded-xl p-5 text-center cursor-pointer hover:border-emerald-600 transition-colors">
            <input type="file" accept=".csv" className="hidden" onChange={e => {
              const f = e.target.files?.[0] || null;
              setFile(f); setText("");
              if (f) {
                const reader = new FileReader();
                reader.onload = ev => {
                  const content = ev.target?.result as string ?? "";
                  const firstLine = content.split("\n")[0] || "";
                  const cols = firstLine.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
                  setDetectedKeys(cols);
                  const autoMap: Record<string, string> = {};
                  for (const field of ourFields) {
                    const match = cols.find(k => k.toLowerCase() === field.key || k.toLowerCase().includes(field.key));
                    if (match) autoMap[field.key] = match;
                  }
                  setMapping(autoMap);
                  setShowMapping(true);
                };
                reader.readAsText(f);
              }
            }} />
            {file ? <span className="text-sm text-emerald-400">{file.name}</span> : <span className="text-sm text-gray-500">Click to upload .csv file</span>}
          </label>
          {!file && <textarea value={text} onChange={e => {
            setText(e.target.value);
            const firstLine = e.target.value.split("\n")[0] || "";
            if (firstLine.includes(",")) {
              const cols = firstLine.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
              setDetectedKeys(cols);
              const autoMap: Record<string, string> = {};
              for (const field of ourFields) {
                const match = cols.find(k => k.toLowerCase() === field.key || k.toLowerCase().includes(field.key));
                if (match) autoMap[field.key] = match;
              }
              setMapping(autoMap);
              setShowMapping(cols.length > 1);
            }
          }} rows={4} placeholder={"email,name,event\nuser@example.com,Priya,purchase"} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 resize-none" />}
        </div>
      )}

      {tab === "json" && (
        <div className="space-y-3">
          <label className="block border-2 border-dashed border-gray-700 rounded-xl p-5 text-center cursor-pointer hover:border-emerald-600 transition-colors">
            <input type="file" accept=".json" className="hidden" onChange={e => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFile(f);
              const reader = new FileReader();
              reader.onload = ev => setText(ev.target?.result as string ?? "");
              reader.readAsText(f);
            }} />
            {file ? <span className="text-sm text-emerald-400">{file.name}</span> : <span className="text-sm text-gray-500">Click to upload .json file</span>}
          </label>
          {!file && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Or paste JSON</span>
                <button onClick={() => setText(JSON.stringify([
              {email:"priya.sharma@example.com",name:"Priya Sharma",phone:"+91-9876543210",event_type:"purchase",order_id:"ORD-001",amount:4599,status:"completed",channel:"app",location:"Mumbai",timestamp:"2026-04-01T10:00:00Z"},
              {email:"rohan.mehta@example.com",name:"Rohan Mehta",phone:"+91-9823456781",event_type:"support_ticket",status:"open",channel:"chat",location:"Delhi",timestamp:"2026-04-02T14:00:00Z"},
              {email:"aisha.khan@example.com",name:"Aisha Khan",phone:"+91-9712345678",event_type:"purchase",order_id:"ORD-002",amount:1299,status:"completed",channel:"web",location:"Bangalore",timestamp:"2026-04-03T11:00:00Z"}
            ],null,2))} className="text-xs text-emerald-400 hover:underline">Load example</button>
              </div>
              <textarea value={text} onChange={e => handleTextChange(e.target.value)} rows={4} placeholder={'[{"email":"user@example.com","event":"purchase"}]'} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 resize-none" />
            </div>
          )}
        </div>
      )}

      {tab === "sheets" && (
        <div className="space-y-3">
          <label className="text-sm text-gray-400 block">Public Google Sheets URL</label>
          <div className="flex gap-2">
            <input type="text" value={sheetUrl} onChange={e => { setSheetUrl(e.target.value); setDetectedKeys([]); setShowMapping(false); }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500" />
            <button
              onClick={async () => {
                if (!sheetUrl) return;
                try {
                  const res = await fetch("/api/ingest/csv", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-org-id": orgId },
                    body: JSON.stringify({ sheet_url: sheetUrl, preview_only: true }),
                  });
                  const data = await res.json();
                  if (data.columns) {
                    setDetectedKeys(data.columns);
                    const autoMap: Record<string, string> = {};
                    for (const field of ourFields) {
                      const match = data.columns.find((k: string) => k.toLowerCase() === field.key || k.toLowerCase().includes(field.key));
                      if (match) autoMap[field.key] = match;
                    }
                    setMapping(autoMap);
                    setShowMapping(true);
                  }
                } catch { /* silent */ }
              }}
              className="px-4 py-3 rounded-xl text-sm font-medium transition-colors shrink-0"
              style={{ background:"var(--bg-surface-2)", border:"1px solid var(--border)", color:"var(--text-primary)" }}>
              Preview columns
            </button>
          </div>
        </div>
      )}

      {/* Field Mapping UI — shown for all tabs when columns are detected */}
      {showMapping && detectedKeys.length > 0 && (
        <div className="mt-4 rounded-xl border p-4 space-y-3" style={{ background:"var(--bg-surface-2)", border:"1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color:"var(--text-primary)" }}>Map your fields → our fields</p>
            <span className="text-xs" style={{ color:"var(--text-muted)" }}>optional — we auto-detect what we can</span>
          </div>
          <div className="space-y-2">
            {ourFields.map(field => (
              <div key={field.key} className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <span className="text-xs font-mono px-2 py-1 rounded" style={{ background:"var(--bg-surface-3)", color: field.required ? "#5b8fff" : "var(--text-muted)" }}>
                    {field.label}{field.required ? " *" : ""}
                  </span>
                </div>
                <span style={{ color:"var(--text-muted)" }} className="text-xs">←</span>
                <select
                  value={mapping[field.key] || ""}
                  onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                  className="flex-1 text-xs rounded-lg px-2 py-1.5 focus:outline-none appearance-none"
                  style={{ background:"var(--bg-surface)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                >
                  <option value="">— auto detect —</option>
                  {detectedKeys.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm mt-3">{error}</div>}

      {result && (
        <div className="bg-emerald-950/30 border border-emerald-800 rounded-lg px-4 py-3 text-sm mt-3 space-y-2">
          <div className="text-emerald-400 font-medium">Import successful</div>
          <div className="text-gray-400 text-xs">Mapped: {String(result.events_mapped ?? result.total_rows ?? 0)} · Ingested: {String(result.events_ingested ?? 0)} · Skipped: {String(result.events_skipped ?? result.skipped ?? 0)}</div>
          {Array.isArray(result.columns_detected) && <div className="text-gray-500 text-xs">Columns: {(result.columns_detected as string[]).join(", ")}</div>}
        </div>
      )}

      {!result ? (
        <button onClick={handleImport} disabled={loading || !canImport} className="mt-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-5 py-2 rounded-xl text-sm font-medium transition-colors">
          {loading ? "Importing..." : "Import & Build Graph"}
        </button>
      ) : (
        <Link href="/dashboard" className="mt-4 inline-block bg-emerald-600 hover:bg-emerald-500 px-5 py-2 rounded-xl text-sm font-medium transition-colors">
          View in Dashboard →
        </Link>
      )}
    </section>
  );
}

// ── MCP / API Access Section ─────────────────────────────────────

function MCPAccessSection({ apiKey }: { orgId: string; apiKey: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);

  const [mcpUrl, setMcpUrl] = useState("/api/mcp");
  useEffect(() => { setMcpUrl(`${window.location.origin}/api/mcp`); }, []);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-base font-semibold mb-1">MCP / API Access</h2>
      <p className="text-sm text-gray-400 mb-3">
        Connect any AI agent or tool to ContextMesh. Use these credentials to let your Nurix voice agents, Claude, or any MCP-compatible tool query customer context in real-time.
      </p>

      {/* Chevron toggle */}
      <button onClick={() => setExpanded(!expanded)}
        className="flex flex-col items-center mx-auto mb-2 opacity-40 hover:opacity-80 transition-opacity">
        {expanded ? (
          <div>
            <svg width="24" height="14" viewBox="0 0 24 14" style={{ transform:"rotate(180deg)" }}>
              <polyline points="4,10 12,4 20,10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:"var(--text-muted)" }}/>
            </svg>
            <svg width="24" height="14" viewBox="0 0 24 14" style={{ transform:"rotate(180deg)", marginTop:-6 }}>
              <polyline points="4,10 12,4 20,10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:"var(--text-muted)", opacity:0.5 }}/>
            </svg>
          </div>
        ) : (
          <div style={{ animation:"chevronBounce 1.4s ease-in-out infinite" }}>
            <svg width="24" height="14" viewBox="0 0 24 14">
              <polyline points="4,4 12,10 20,4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:"var(--text-muted)" }}/>
            </svg>
            <svg width="24" height="14" viewBox="0 0 24 14" style={{ marginTop:-6 }}>
              <polyline points="4,4 12,10 20,4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:"var(--text-muted)", opacity:0.5 }}/>
            </svg>
          </div>
        )}
      </button>

      {expanded && <div className="space-y-4" style={{ animation:"fadeSlideIn 0.3s ease both" }}>
        {/* MCP Endpoint */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">MCP Server URL</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-emerald-400 font-mono truncate">
              {mcpUrl}
            </code>
            <button onClick={() => copy(mcpUrl, "url")}
              className="text-xs px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors shrink-0">
              {copied === "url" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* API Key */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">API Key</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-300 font-mono truncate">
              {keyVisible ? (apiKey || "—") : (apiKey ? `${apiKey.slice(0, 12)}${"•".repeat(20)}` : "—")}
            </code>
            <button onClick={() => setKeyVisible(v => !v)}
              className="text-xs px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors shrink-0">
              {keyVisible ? "Hide" : "Show"}
            </button>
            <button onClick={() => copy(apiKey, "key")}
              className="text-xs px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors shrink-0">
              {copied === "key" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Available tools */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2">Available Tools</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: "get_context", desc: "Get full customer brief by phone/email — use this in Nurix agents" },
              { name: "search", desc: "Natural language search across the context graph" },
              { name: "analyze", desc: "AI reasoning chain on current graph data" },
              { name: "track_event", desc: "Ingest a new event from any system" },
              { name: "get_commitments", desc: "Fetch open/breached commitments for a customer" },
              { name: "get_alerts", desc: "Get active proactive alerts" },
            ].map(tool => (
              <div key={tool.name} className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5">
                <div className="text-xs font-mono text-violet-400">{tool.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{tool.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Nurix agent example */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-400 mb-2">Example: Nurix agent call</div>
          <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">{`POST ${mcpUrl}
Authorization: Bearer ${apiKey ? apiKey.slice(0, 20) + "..." : "<your-api-key>"}
Content-Type: application/json

{
  "method": "tools/call",
  "params": {
    "name": "get_context",
    "arguments": { "phone": "{{customer_phone}}" }
  }
}`}</pre>
        </div>
      </div>}
    </section>
  );
}

// ── Webhooks Section (POST — push intelligence OUT) ──────────────

function WebhooksSection({ orgId }: { orgId: string }) {
  const [webhooks, setWebhooks] = useState<{ id: string; name: string; url: string; condition: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCondition, setNewCondition] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!orgId) return;
    fetch("/api/webhooks", { headers: { "x-org-id": orgId } })
      .then(r => r.json())
      .then(d => setWebhooks(d.webhooks || []))
      .catch(console.error);
  }, [orgId]);

  const handleAdd = async () => {
    if (!newUrl || !newName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({ name: newName, url: newUrl, condition: newCondition }),
      });
      const data = await res.json();
      if (res.ok) {
        setWebhooks(p => [data.webhook, ...p]);
        setNewName(""); setNewUrl(""); setNewCondition(""); setAdding(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/webhooks/${id}`, { method: "DELETE", headers: { "x-org-id": orgId } });
    setWebhooks(p => p.filter(w => w.id !== id));
  };

  const handleTest = async (wh: { id: string; url: string; name: string }) => {
    setTesting(wh.id);
    try {
      const res = await fetch("/api/webhooks/fire", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({
          url: wh.url,
          payload: {
            source: "contextmesh",
            event: "test_webhook",
            timestamp: new Date().toISOString(),
            data: { message: "ContextMesh webhook test — connection successful", org_id: orgId },
          },
        }),
      });
      const data = await res.json();
      setTestResult(p => ({ ...p, [wh.id]: data.ok ? `✓ ${data.status} OK` : `✗ ${data.status} Error` }));
    } catch {
      setTestResult(p => ({ ...p, [wh.id]: "✗ Connection failed" }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="mb-1">
        <h2 className="text-base font-semibold">Webhooks</h2>
      </div>
      <p className="text-xs text-gray-500 mb-5">Push intelligence OUT to your system. Fires automatically when Analyze matches your condition.</p>

      {adding && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4 space-y-3">
          <input
            type="text"
            placeholder="Name (e.g. Churn Alert → Salesforce)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          />
          <input
            type="url"
            placeholder="Webhook URL (https://...)"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          />
          <div>
            <p className="text-xs text-gray-500 mb-1">
              Fire condition <span className="text-gray-600">(leave blank to always fire)</span>
            </p>
            <input
              type="text"
              placeholder='e.g.  finding contains "churn"  or  confidence > 0.8'
              value={newCondition}
              onChange={e => setNewCondition(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[10px] text-gray-600 mt-1">
              Supported: <code>finding contains &quot;...&quot;</code> · <code>recommendation contains &quot;...&quot;</code> · <code>confidence &gt; 0.8</code> · <code>impact contains &quot;...&quot;</code>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="flex-1 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2 rounded-lg transition-colors">
              {saving ? "Saving..." : "Save Webhook"}
            </button>
            <button onClick={() => setAdding(false)} className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {webhooks.length === 0 && !adding && (
        <div className="text-center py-8 border border-dashed border-gray-800 rounded-xl space-y-4">
          <p className="text-gray-600 text-sm">No webhooks configured. Add one to push alerts to your system.</p>
          <button onClick={() => setAdding(true)} className="text-sm bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg transition-colors font-medium">
            + Add Webhook
          </button>
        </div>
      )}

      <div className="space-y-3">
        {webhooks.map(wh => (
          <div key={wh.id} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium">{wh.name}</div>
                <div className="text-[10px] text-gray-500 font-mono mt-0.5 truncate max-w-[300px]">{wh.url}</div>
                {wh.condition ? (
                  <div className="text-[10px] font-mono text-emerald-600 mt-1">if: {wh.condition}</div>
                ) : (
                  <div className="text-[10px] text-gray-600 mt-1">fires on every analysis</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {testResult[wh.id] && (
                  <span className={`text-[10px] ${testResult[wh.id].startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                    {testResult[wh.id]}
                  </span>
                )}
                <button
                  onClick={() => handleTest(wh)}
                  disabled={testing === wh.id}
                  className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {testing === wh.id ? "Testing..." : "Test"}
                </button>
                <button
                  onClick={() => handleDelete(wh.id)}
                  className="text-xs text-gray-600 hover:text-red-400 px-2 py-1.5 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
