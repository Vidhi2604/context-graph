"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    features: ["1K events/mo", "Basic search", "25 nodes", "7-day timeline"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "",
    features: ["10K events/mo", "LLM search", "100 nodes", "90-day timeline", "REST API"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "",
    features: ["Unlimited", "Full reasoning chain", "Unlimited nodes", "MCP + SDK"],
    highlight: true,
  },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const [orgName, setOrgName] = useState("");
  const [currentPlan, setCurrentPlan] = useState("enterprise");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const orgId = session?.orgId || (typeof window !== "undefined" ? localStorage.getItem("orgId") || "" : "");
  const vertical = session?.vertical || (typeof window !== "undefined" ? localStorage.getItem("vertical") || "retail" : "retail");

  useEffect(() => {
    // GET /api/org requires userId query param — get from session or localStorage
    const userId = (session?.user as { id?: string })?.id
      || (typeof window !== "undefined" ? localStorage.getItem("userId") || "" : "");

    if (!userId && !orgId) return;

    const url = userId ? `/api/org?userId=${userId}` : `/api/org?userId=`;
    fetch(url, { headers: orgId ? { "x-org-id": orgId } : {} })
      .then((r) => r.json())
      .then((data) => {
        // Find current org in the list
        const org = data.orgs?.find((o: { id: string }) => o.id === orgId) || data.orgs?.[0];
        if (org) {
          setOrgName(org.name || "");
          setCurrentPlan(org.plan || "enterprise");
          setApiKey(org.apiKey || "");
        }
      })
      .catch(() => {});
  }, [orgId, session]);

  const handleSaveOrg = async () => {
    setSaving(true);
    setSaved(false);
    await new Promise((r) => setTimeout(r, 500)); // simulate save
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePlanChange = async (planId: string) => {
    if (planId === currentPlan) return;
    setPlanSaving(true);
    try {
      await fetch("/api/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({ orgId, plan: planId }),
      });
      setCurrentPlan(planId);
      if (typeof window !== "undefined") localStorage.setItem("plan", planId);
    } catch {}
    setPlanSaving(false);
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
            <Link href="/dashboard" className="text-xl font-bold">
              <span className="text-emerald-400">Context</span>Mesh
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
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm text-gray-400 block mb-1.5">Vertical</label>
                <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-300">
                  <span suppressHydrationWarning>{vertical === "retail" ? "🏪" : "🏥"}</span> {vertical.charAt(0).toUpperCase() + vertical.slice(1)}
                  <span className="text-gray-600 text-xs ml-1">(cannot change after creation)</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-sm text-gray-400 block mb-1.5">Org ID</label>
                <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-500 font-mono truncate">
                  {orgId || "—"}
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

        {/* API Key */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-base font-semibold mb-1">API Key</h2>
          <p className="text-xs text-gray-500 mb-4">
            Use this key to authenticate MCP, REST API, and SDK requests. Keep it secret.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-300 truncate">
              {apiKey
                ? apiKeyVisible
                  ? apiKey
                  : `sk_${"•".repeat(24)}${apiKey.slice(-4)}`
                : "No API key generated"}
            </div>
            <button
              onClick={() => setApiKeyVisible(!apiKeyVisible)}
              className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
            >
              {apiKeyVisible ? "Hide" : "Show"}
            </button>
            <button
              onClick={handleCopyKey}
              disabled={!apiKey}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40 px-3 py-2.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Format: sk_{"{tenantId}"}_{"{32 hex chars}"}
          </p>
        </section>

        {/* Plan */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-base font-semibold mb-1">Plan</h2>
          <p className="text-xs text-gray-500 mb-4">
            No payment required — plan controls feature access only.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                onClick={() => handlePlanChange(plan.id)}
                disabled={planSaving}
                className={`text-left p-4 rounded-xl border transition-all ${
                  currentPlan === plan.id
                    ? "border-emerald-500 bg-emerald-900/20"
                    : "border-gray-700 bg-gray-800 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{plan.name}</span>
                  {currentPlan === plan.id && (
                    <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </div>
                {plan.price && <div className="text-xs text-emerald-400 mb-2">{plan.price}</div>}
                <ul className="space-y-1">
                  {plan.features.map((f) => (
                    <li key={f} className="text-[10px] text-gray-500">✓ {f}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </section>

        {/* Connectors — Pull data IN */}
        <ConnectorsSection orgId={orgId} />

        {/* Webhooks */}
        <WebhooksSection orgId={orgId} />

        {/* Danger zone */}
        <section className="bg-gray-900 border border-red-900/30 rounded-xl p-6">
          <h2 className="text-base font-semibold text-red-400 mb-1">Danger Zone</h2>
          <p className="text-xs text-gray-500 mb-4">
            Reset demo data to restore the original 50 seeded journeys.
          </p>
          <button
            onClick={async () => {
              if (!confirm("Reset demo data? This will delete all current graph data for this org.")) return;
              await fetch(`/api/schema?seed=true`, {
                method: "POST",
                headers: { "x-org-id": orgId },
              });
            }}
            className="text-sm text-red-400 border border-red-800 hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors"
          >
            Reset Demo Data
          </button>
        </section>
      </main>
    </div>
  );
}

// ── Connector definitions ────────────────────────────────────────

const CONNECTOR_ICONS: Record<string, React.ReactNode> = {
  hubspot: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#ff7a59">
      <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.266-1.978V3.04a2.198 2.198 0 0 0-2.195-2.195h-.066a2.198 2.198 0 0 0-2.195 2.195v.066a2.198 2.198 0 0 0 1.266 1.978V7.93a6.232 6.232 0 0 0-2.963 1.302L5.85 4.533a2.45 2.45 0 1 0-1.124 1.232l7.285 4.694a6.246 6.246 0 0 0-.925 3.285c0 1.07.27 2.076.746 2.953l-2.215 2.215a1.917 1.917 0 1 0 1.061 1.06l2.215-2.215a6.232 6.232 0 0 0 3.447 1.038c3.445 0 6.237-2.792 6.237-6.237a6.232 6.232 0 0 0-4.413-5.928zm-1.929 9.315a3.39 3.39 0 1 1 0-6.78 3.39 3.39 0 0 1 0 6.78z"/>
    </svg>
  ),
  zendesk: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#03363d">
      <path d="M11.5 0C5.149 0 0 5.149 0 11.5S5.149 23 11.5 23 23 17.851 23 11.5 17.851 0 11.5 0zm-2 15.5l-5-5h10l-5 5zm5-7l-5-5 5 5V3h5v10h-5V8.5z"/>
    </svg>
  ),
  salesforce: (
    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{background: '#00a1e0'}}>
      <svg viewBox="0 0 32 20" className="w-6 h-4" fill="white">
        <path d="M13.3 2.5C14.4 1.3 16 .5 17.8.5c2.3 0 4.3 1.3 5.4 3.2.9-.4 1.9-.6 3-.6 4.1 0 7.4 3.4 7.4 7.5s-3.3 7.5-7.4 7.5c-.5 0-1-.1-1.5-.2-.9 1.6-2.6 2.6-4.6 2.6-.8 0-1.5-.2-2.2-.5-.9 2-2.9 3.4-5.2 3.4-2.4 0-4.5-1.5-5.4-3.6-.4.1-.8.1-1.2.1C3.3 20 0 16.7 0 12.6c0-2.2 1.2-4.2 3-5.2-.2-.6-.3-1.2-.3-1.8C2.7 2.5 5.2 0 8.2 0c2 0 3.8 1 4.9 2.5z"/>
      </svg>
    </div>
  ),
  zoho: (
    <div className="w-7 h-7 rounded flex items-center justify-center" style={{background: '#e42527'}}>
      <span className="text-white text-sm font-bold">Z</span>
    </div>
  ),
  nurix: (
    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">N</div>
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
  { id: "nurix",     name: "Nurix",      desc: "AI voice call transcripts",              credFields: [{ key: "api_url", label: "API URL", type: "text" }, { key: "api_key", label: "API Key", type: "password" }, { key: "agent_id", label: "Agent ID", type: "text" }] },
  { id: "custom",    name: "Custom",     desc: "Any system via REST API",                credFields: [{ key: "api_url", label: "API URL", type: "text" }, { key: "api_key", label: "API Key", type: "password" }] },
];

const WEBHOOK_TRIGGERS = [
  { id: "churn_risk",         label: "Churn Risk Detected",    desc: "Risk score exceeds threshold" },
  { id: "policy_drift",       label: "Policy Drift",           desc: "Override rate > 30%" },
  { id: "commitment_breach",  label: "Commitment Breached",    desc: "Promise deadline passed" },
  { id: "anomaly_spike",      label: "Anomaly Spike",          desc: "Event rate 2x above average" },
  { id: "readmission_risk",   label: "Readmission Risk",       desc: "Healthcare: high readmission score" },
];

// ── Connectors Section (GET — pull data IN) ──────────────────────

function ConnectorsSection({ orgId }: { orgId: string }) {
  const [connected, setConnected] = useState<Record<string, boolean>>({});
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
        for (const c of data.connectors || []) conn[c.type] = true;
        setConnected(conn);
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
        setStatus(p => ({ ...p, [connId]: data.connection_test?.detail || "Connected" }));
        setExpanding(null);
      } else {
        setStatus(p => ({ ...p, [connId]: data.error || "Failed" }));
      }
    } catch {
      setStatus(p => ({ ...p, [connId]: "Connection failed" }));
    }
  };

  const handleSync = async (connId: string) => {
    setSyncing(connId);
    try {
      const res = await fetch("/api/connectors/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({ type: connId }),
      });
      const data = await res.json();
      setStatus(p => ({ ...p, [connId]: `Synced ${data.sync_result?.events_synced || 0} events` }));
    } catch {
      setStatus(p => ({ ...p, [connId]: "Sync failed" }));
    } finally {
      setSyncing(null);
    }
  };

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-base font-semibold mb-1">Connectors</h2>
      <p className="text-xs text-gray-500 mb-5">Pull data IN from external systems. Events flow into the context graph automatically.</p>
      <div className="grid grid-cols-3 gap-3">
        {CONNECTORS.map(c => {
          const isConn = connected[c.id];
          const isOpen = expanding === c.id;
          return (
            <div key={c.id} className={`border rounded-xl p-4 transition-all ${isConn ? "border-emerald-700 bg-emerald-900/10" : "border-gray-800 bg-gray-800/50"}`}>
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
                  <button
                    onClick={() => handleSync(c.id)}
                    disabled={syncing === c.id}
                    className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 py-1.5 rounded-lg transition-colors"
                  >
                    {syncing === c.id ? "Syncing..." : "Sync Now"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Webhooks Section (POST — push intelligence OUT) ──────────────

function WebhooksSection({ orgId }: { orgId: string }) {
  const [webhooks, setWebhooks] = useState<{ id: string; name: string; url: string; triggers: string[] }[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newTriggers, setNewTriggers] = useState<string[]>(["churn_risk", "policy_drift", "commitment_breach"]);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const handleAdd = () => {
    if (!newUrl || !newName) return;
    setWebhooks(p => [...p, { id: `wh_${Date.now()}`, name: newName, url: newUrl, triggers: newTriggers }]);
    setNewName(""); setNewUrl(""); setAdding(false);
  };

  const handleTest = async (wh: { id: string; url: string; name: string }) => {
    setTesting(wh.id);
    try {
      const res = await fetch(wh.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "contextmesh",
          event: "test_webhook",
          timestamp: new Date().toISOString(),
          data: { message: "ContextMesh webhook test — connection successful", org_id: orgId },
        }),
      });
      setTestResult(p => ({ ...p, [wh.id]: res.ok ? `✓ ${res.status} OK` : `✗ ${res.status} Error` }));
    } catch {
      setTestResult(p => ({ ...p, [wh.id]: "✗ Connection failed" }));
    } finally {
      setTesting(null);
    }
  };

  const toggleTrigger = (id: string) => {
    setNewTriggers(p => p.includes(id) ? p.filter(t => t !== id) : [...p, id]);
  };

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold">Webhooks</h2>
        <button onClick={() => setAdding(true)} className="text-xs bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg transition-colors">
          + Add Webhook
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-5">Push intelligence OUT to any system — Salesforce, Zoho, Sell.do, HubSpot, or your own. Works with any URL.</p>

      {/* Add webhook form */}
      {adding && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4 space-y-3">
          <input
            type="text"
            placeholder="Name (e.g. Salesforce CRM)"
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
            <p className="text-xs text-gray-500 mb-2">Trigger on:</p>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_TRIGGERS.map(t => (
                <button
                  key={t.id}
                  onClick={() => toggleTrigger(t.id)}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                    newTriggers.includes(t.id)
                      ? "border-emerald-500 bg-emerald-900/20 text-emerald-400"
                      : "border-gray-700 text-gray-500 hover:border-gray-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 text-sm bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg transition-colors">
              Save Webhook
            </button>
            <button onClick={() => setAdding(false)} className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {webhooks.length === 0 && !adding && (
        <div className="text-center py-8 text-gray-600 text-sm border border-dashed border-gray-800 rounded-xl">
          No webhooks configured. Add one to push alerts to Salesforce, Zoho, HubSpot, or any system.
        </div>
      )}

      <div className="space-y-3">
        {webhooks.map(wh => (
          <div key={wh.id} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium">{wh.name}</div>
                <div className="text-[10px] text-gray-500 font-mono mt-0.5 truncate max-w-[300px]">{wh.url}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {wh.triggers.map(t => (
                    <span key={t} className="text-[9px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                      {WEBHOOK_TRIGGERS.find(wt => wt.id === t)?.label || t}
                    </span>
                  ))}
                </div>
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
                  onClick={() => setWebhooks(p => p.filter(w => w.id !== wh.id))}
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
