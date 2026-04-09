"use client";

import { useEffect, useState } from "react";
import Link from "next/link";


export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("orgId") || "" : "";

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    setLoading(false);
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
            <Link href="/dashboard/analytics" className="px-3 py-1 rounded bg-gray-800 text-white">Analytics</Link>
            <Link href="/dashboard/policies" className="px-3 py-1 rounded text-gray-400 hover:text-white">Policies</Link>
            <Link href="/dashboard/agents" className="px-3 py-1 rounded text-gray-400 hover:text-white">Agents</Link>
            <Link href="/dashboard/commitments" className="px-3 py-1 rounded text-gray-400 hover:text-white">Commitments</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold mb-6">Decision Analytics</h2>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-48 bg-gray-900 rounded-xl" />
            <div className="h-48 bg-gray-900 rounded-xl" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {/* Event Volume by Type */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Event Volume by Type</h3>
              <EventVolumeChart />
            </div>

            {/* Exception Rate Trend */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Exception Rate (Last 90 Days)</h3>
              <ExceptionTrend />
            </div>

            {/* Source Breakdown */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Events by Channel</h3>
              <SourceBreakdown />
            </div>

            {/* Top Products/Diagnoses */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Top Entities</h3>
              <TopEntities />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function EventVolumeChart() {
  const [data, setData] = useState<{ type: string; count: number }[]>([]);

  useEffect(() => {
    setData([
      { type: "page_view", count: 0 },
      { type: "purchase", count: 0 },
      { type: "return_initiated", count: 0 },
    ]);
  }, []);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      {data.length === 0 ? (
        <p className="text-gray-600 text-sm">Connect Neo4j to see event data</p>
      ) : (
        data.map((d) => (
          <div key={d.type} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-32 truncate capitalize">
              {d.type.replace(/_/g, " ")}
            </span>
            <div className="flex-1 bg-gray-800 rounded-full h-4">
              <div
                className="bg-emerald-500 h-4 rounded-full transition-all"
                style={{ width: `${(d.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-10 text-right">{d.count}</span>
          </div>
        ))
      )}
    </div>
  );
}

function ExceptionTrend() {
  return (
    <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
      Connect Neo4j to see exception trends
    </div>
  );
}

function SourceBreakdown() {
  const sources = [
    { source: "Web SDK", color: "#3b82f6" },
    { source: "App SDK", color: "#8b5cf6" },
    { source: "Voice STT", color: "#10b981" },
    { source: "CRM", color: "#f97316" },
  ];

  return (
    <div className="space-y-2">
      {sources.map((s) => (
        <div key={s.source} className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
          <span className="text-xs text-gray-400 flex-1">{s.source}</span>
          <span className="text-xs text-gray-600">—</span>
        </div>
      ))}
      <p className="text-[10px] text-gray-600 mt-2">Data populates after events are ingested</p>
    </div>
  );
}

function TopEntities() {
  return (
    <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
      Connect Neo4j to see top entities
    </div>
  );
}
