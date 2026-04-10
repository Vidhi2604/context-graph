"use client";

import { useState, useEffect } from "react";
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
                  {vertical === "retail" ? "🏪" : "🏥"} {vertical.charAt(0).toUpperCase() + vertical.slice(1)}
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
