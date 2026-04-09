"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AgentRow {
  name: string;
  role: string;
  handled: number;
  exception_rate: number;
  retention_rate: number;
}

export default function AgentsPage() {
  const [agents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("orgId") || "" : "";
  const vertical = typeof window !== "undefined" ? localStorage.getItem("vertical") || "retail" : "retail";

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    // TODO: dedicated agent stats endpoint. For now placeholder.
    setLoading(false);
  }, [orgId]);

  const isRetail = vertical === "retail";
  const entityLabel = isRetail ? "Agent" : "Provider";

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
            <Link href="/dashboard/policies" className="px-3 py-1 rounded text-gray-400 hover:text-white">Policies</Link>
            <Link href="/dashboard/agents" className="px-3 py-1 rounded bg-gray-800 text-white">Agents</Link>
            <Link href="/dashboard/commitments" className="px-3 py-1 rounded text-gray-400 hover:text-white">Commitments</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold mb-6">{entityLabel} Performance</h2>

        {loading ? (
          <div className="animate-pulse h-64 bg-gray-900 rounded-xl" />
        ) : agents.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500">No {entityLabel.toLowerCase()} data yet.</p>
            <p className="text-xs text-gray-600 mt-2">
              Data populates after events with {isRetail ? "agent" : "provider"} references are ingested.
            </p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                  <th className="text-left px-6 py-3">{entityLabel}</th>
                  <th className="text-left px-6 py-3">Role</th>
                  <th className="text-right px-6 py-3">Handled</th>
                  <th className="text-right px-6 py-3">Exception Rate</th>
                  <th className="text-right px-6 py-3">{isRetail ? "Retention" : "Recovery"} Rate</th>
                  <th className="text-left px-6 py-3">Performance</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard?query=${encodeURIComponent(a.name)}`}
                        className="text-emerald-400 hover:underline text-sm font-medium"
                      >
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">{a.role}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-400">{a.handled}</td>
                    <td className="px-6 py-4 text-right text-sm font-mono">
                      <span className={a.exception_rate > 0.6 ? "text-yellow-400" : "text-gray-400"}>
                        {Math.round(a.exception_rate * 100)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-mono">
                      <span className={a.retention_rate > 0.8 ? "text-emerald-400" : "text-gray-400"}>
                        {Math.round(a.retention_rate * 100)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-24 bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full"
                          style={{ width: `${a.retention_rate * 100}%` }}
                        />
                      </div>
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
