"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardHeader from "@/components/DashboardHeader";

interface PolicyRow {
  policy: string;
  version: string;
  status: string;
  override_rate: number;
  overrides: number;
  total: number;
}

interface AlertRow {
  type: string;
  severity: string;
  message: string;
  data: PolicyRow;
  created_at: string;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("orgId") || "" : "";

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }

    fetch("/api/alerts", { headers: { "x-org-id": orgId } })
      .then((r) => r.json())
      .then((data) => {
        const all: AlertRow[] = data.alerts || [];
        const drift = all.filter((a) => a.type === "policy_drift").map((a) => a.data);
        setPolicies(drift);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  const driftingCount = policies.filter((p) => p.override_rate > 0.3).length;
  const healthyCount = policies.filter((p) => p.override_rate <= 0.3).length;
  const avgDrift = policies.length
    ? policies.reduce((s, p) => s + p.override_rate, 0) / policies.length
    : 0;

return (
    <div className="min-h-screen bg-gray-950 text-white">
      <DashboardHeader orgId={orgId} />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Policy Drift Analysis</h2>
          <span className="text-xs text-gray-500">Last 90 days</span>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse h-20 bg-gray-900 rounded-xl" />
              ))}
            </div>
            <div className="animate-pulse h-64 bg-gray-900 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4">
                <div className={`text-2xl font-bold ${driftingCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {driftingCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">Drifting Policies</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4">
                <div className="text-2xl font-bold text-emerald-400">{healthyCount}</div>
                <div className="text-xs text-gray-500 mt-1">Healthy Policies</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4">
                <div className={`text-2xl font-bold ${avgDrift > 0.3 ? "text-red-400" : "text-gray-300"}`}>
                  {Math.round(avgDrift * 100)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Avg Override Rate</div>
              </div>
            </div>


            {/* Policy table */}
            {policies.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-gray-500">No policy drift detected.</p>
                <p className="text-xs text-gray-600 mt-2">
                  Policies are being followed as written. Data populates after events with policy references are ingested.
                </p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-3 border-b border-gray-800">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Policy Override Rates</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                      <th className="text-left px-6 py-3">Policy</th>
                      <th className="text-left px-6 py-3">Version</th>
                      <th className="text-left px-6 py-3">Status</th>
                      <th className="text-right px-6 py-3">Override Rate</th>
                      <th className="text-right px-6 py-3">Overrides</th>
                      <th className="text-right px-6 py-3">Total</th>
                      <th className="text-left px-6 py-3">Drift Indicator</th>
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
                        <td className="px-6 py-4 text-sm text-gray-400 font-mono">{p.version}</td>
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
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-800 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full"
                                style={{
                                  width: `${Math.min(p.override_rate * 100, 100)}%`,
                                  backgroundColor: p.override_rate > 0.5 ? "#ef4444" : p.override_rate > 0.3 ? "#eab308" : "#10b981",
                                }}
                              />
                            </div>
                            <span className={`text-sm font-mono w-10 text-right ${
                              p.override_rate > 0.5 ? "text-red-400" :
                              p.override_rate > 0.3 ? "text-yellow-400" :
                              "text-gray-400"
                            }`}>
                              {Math.round(p.override_rate * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-400">{p.overrides}</td>
                        <td className="px-6 py-4 text-right text-sm text-gray-400">{p.total}</td>
                        <td className="px-6 py-4">
                          {p.override_rate > 0.5 ? (
                            <span className="flex items-center gap-1 text-xs text-red-400">
                              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> Critical drift
                            </span>
                          ) : p.override_rate > 0.3 ? (
                            <span className="flex items-center gap-1 text-xs text-yellow-400">
                              <span className="w-2 h-2 rounded-full bg-yellow-400" /> Drifting
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Healthy
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
