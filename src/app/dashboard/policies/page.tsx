"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PolicyRow {
  policy: string;
  version: string;
  status: string;
  override_rate: number;
  overrides: number;
  total: number;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("orgId") || "" : "";

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }

    // Fetch alerts which include policy drift data
    fetch("/api/alerts", { headers: { "x-org-id": orgId } })
      .then((r) => r.json())
      .then((data) => {
        const driftAlerts = (data.alerts || [])
          .filter((a: { type: string }) => a.type === "policy_drift")
          .map((a: { data: PolicyRow }) => a.data);
        setPolicies(driftAlerts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-xl font-bold">
            <span className="text-emerald-400">Context</span>Mesh
          </Link>
          <nav className="flex gap-1 text-sm">
            <Link href="/dashboard" className="px-3 py-1 rounded text-gray-400 hover:text-white">Search</Link>
            <Link href="/dashboard/analytics" className="px-3 py-1 rounded text-gray-400 hover:text-white">Analytics</Link>
            <Link href="/dashboard/policies" className="px-3 py-1 rounded bg-gray-800 text-white">Policies</Link>
            <Link href="/dashboard/agents" className="px-3 py-1 rounded text-gray-400 hover:text-white">Agents</Link>
            <Link href="/dashboard/commitments" className="px-3 py-1 rounded text-gray-400 hover:text-white">Commitments</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Policy Drift Analysis</h2>
          <span className="text-xs text-gray-500">Last 90 days</span>
        </div>

        {loading ? (
          <div className="animate-pulse h-64 bg-gray-900 rounded-xl" />
        ) : policies.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500">No policy drift detected. Policies are being followed as written.</p>
            <p className="text-xs text-gray-600 mt-2">Data populates after events with policy references are ingested.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                  <th className="text-left px-6 py-3">Policy</th>
                  <th className="text-left px-6 py-3">Version</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-right px-6 py-3">Override Rate</th>
                  <th className="text-right px-6 py-3">Overrides</th>
                  <th className="text-right px-6 py-3">Total Applications</th>
                  <th className="text-left px-6 py-3">Drift</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">
                      <Link
                        href={`/dashboard?query=${encodeURIComponent(p.policy + " exceptions")}`}
                        className="text-emerald-400 hover:underline"
                      >
                        {p.policy}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">{p.version}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        p.status === "active"
                          ? "bg-emerald-900/30 text-emerald-400"
                          : "bg-yellow-900/30 text-yellow-400"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-mono ${
                        p.override_rate > 0.5 ? "text-red-400" : p.override_rate > 0.3 ? "text-yellow-400" : "text-gray-400"
                      }`}>
                        {Math.round(p.override_rate * 100)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-400">{p.overrides}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-400">{p.total}</td>
                    <td className="px-6 py-4">
                      {p.override_rate > 0.3 ? (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <span className="w-2 h-2 rounded-full bg-red-400" />
                          Drifting
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
