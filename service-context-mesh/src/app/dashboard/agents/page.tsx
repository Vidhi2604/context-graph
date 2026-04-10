"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

interface AgentRow {
  name: string;
  role: string;
  handled: number;
  exception_rate: number;
  retention_rate: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<keyof AgentRow>("handled");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const orgId = typeof window !== "undefined" ? localStorage.getItem("orgId") || "" : "";
  const vertical = typeof window !== "undefined" ? localStorage.getItem("vertical") || "retail" : "retail";
  const isRetail = vertical === "retail";
  const entityLabel = isRetail ? "Agent" : "Provider";

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }

    fetch("/api/agents/stats", { headers: { "x-org-id": orgId } })
      .then((r) => r.json())
      .then((data) => setAgents(data.agents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  const sorted = [...agents].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "number" && typeof bv === "number") {
      return sortDir === "desc" ? bv - av : av - bv;
    }
    return sortDir === "desc"
      ? String(bv).localeCompare(String(av))
      : String(av).localeCompare(String(bv));
  });

  const handleSort = (key: keyof AgentRow) => {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: keyof AgentRow }) =>
    sortKey === k ? (
      <span className="ml-1 text-emerald-400">{sortDir === "desc" ? "↓" : "↑"}</span>
    ) : (
      <span className="ml-1 text-gray-700">↕</span>
    );

  // Summary stats
  const totalHandled = agents.reduce((s, a) => s + a.handled, 0);
  const avgException = agents.length
    ? agents.reduce((s, a) => s + a.exception_rate, 0) / agents.length
    : 0;
  const avgRetention = agents.length
    ? agents.reduce((s, a) => s + a.retention_rate, 0) / agents.length
    : 0;
  const topPerformer = agents.reduce<AgentRow | null>(
    (best, a) => (!best || a.retention_rate > best.retention_rate ? a : best),
    null
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/dashboard"><Logo size={26} showText /></Link>
          <nav className="flex gap-1 text-sm">
            <Link href="/dashboard" className="px-3 py-1 rounded text-gray-400 hover:text-white">Search</Link>
            <Link href="/dashboard/analytics" className="px-3 py-1 rounded text-gray-400 hover:text-white">Analytics</Link>
            <Link href="/dashboard/policies" className="px-3 py-1 rounded text-gray-400 hover:text-white">Policies</Link>
            <Link href="/dashboard/agents" className="px-3 py-1 rounded bg-gray-800 text-white">{entityLabel}s</Link>
            <Link href="/dashboard/commitments" className="px-3 py-1 rounded text-gray-400 hover:text-white">Commitments</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <h2 className="text-lg font-semibold">{entityLabel} Performance</h2>

        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse h-20 bg-gray-900 rounded-xl" />
              ))}
            </div>
            <div className="animate-pulse h-64 bg-gray-900 rounded-xl" />
          </div>
        ) : agents.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500">No {entityLabel.toLowerCase()} data yet.</p>
            <p className="text-xs text-gray-600 mt-2">
              Data populates after events with {isRetail ? "agent" : "provider"} references are ingested.
            </p>
            <Link
              href="/dashboard"
              className="inline-block mt-4 text-xs text-emerald-400 hover:underline"
            >
              Go to Search → seed data first
            </Link>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4">
                <div className="text-2xl font-bold text-emerald-400">{agents.length}</div>
                <div className="text-xs text-gray-500 mt-1">Active {entityLabel}s</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4">
                <div className="text-2xl font-bold text-blue-400">{totalHandled.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">Total {isRetail ? "Interactions" : "Visits"}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4">
                <div className={`text-2xl font-bold ${avgException > 0.4 ? "text-red-400" : "text-yellow-400"}`}>
                  {Math.round(avgException * 100)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Avg Exception Rate</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4">
                <div className="text-2xl font-bold text-emerald-400">{Math.round(avgRetention * 100)}%</div>
                <div className="text-xs text-gray-500 mt-1">
                  Avg {isRetail ? "Retention" : "Recovery"} Rate
                </div>
              </div>
            </div>

            {topPerformer && (
              <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-xl px-5 py-3 flex items-center gap-3">
                <span className="text-emerald-400 text-sm">★ Top {entityLabel}:</span>
                <Link
                  href={`/dashboard?query=${encodeURIComponent(topPerformer.name)}`}
                  className="text-white font-medium hover:underline text-sm"
                >
                  {topPerformer.name}
                </Link>
                <span className="text-xs text-gray-400">
                  {topPerformer.handled} handled · {Math.round(topPerformer.retention_rate * 100)}% {isRetail ? "retention" : "recovery"}
                </span>
              </div>
            )}

            {/* Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                    <th
                      className="text-left px-6 py-3 cursor-pointer hover:text-gray-300"
                      onClick={() => handleSort("name")}
                    >
                      {entityLabel} <SortIcon k="name" />
                    </th>
                    <th className="text-left px-6 py-3">Role / Dept</th>
                    <th
                      className="text-right px-6 py-3 cursor-pointer hover:text-gray-300"
                      onClick={() => handleSort("handled")}
                    >
                      Handled <SortIcon k="handled" />
                    </th>
                    <th
                      className="text-right px-6 py-3 cursor-pointer hover:text-gray-300"
                      onClick={() => handleSort("exception_rate")}
                    >
                      Exception Rate <SortIcon k="exception_rate" />
                    </th>
                    <th
                      className="text-right px-6 py-3 cursor-pointer hover:text-gray-300"
                      onClick={() => handleSort("retention_rate")}
                    >
                      {isRetail ? "Retention" : "Recovery"} <SortIcon k="retention_rate" />
                    </th>
                    <th className="text-left px-6 py-3">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard?query=${encodeURIComponent(a.name)}`}
                          className="text-emerald-400 hover:underline text-sm font-medium"
                        >
                          {a.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">{a.role}</td>
                      <td className="px-6 py-4 text-right text-sm text-gray-300 font-mono">{a.handled}</td>
                      <td className="px-6 py-4 text-right text-sm font-mono">
                        <span className={
                          a.exception_rate > 0.5 ? "text-red-400" :
                          a.exception_rate > 0.3 ? "text-yellow-400" :
                          "text-gray-400"
                        }>
                          {Math.round(a.exception_rate * 100)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-mono">
                        <span className={a.retention_rate >= 0.8 ? "text-emerald-400" : "text-gray-400"}>
                          {Math.round(a.retention_rate * 100)}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-800 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${a.retention_rate * 100}%`,
                                backgroundColor: a.retention_rate >= 0.8 ? "#10b981" : a.retention_rate >= 0.6 ? "#eab308" : "#ef4444",
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
