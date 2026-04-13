"use client";

import { useEffect, useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";

interface StatsData {
  events_tracked: number;
  profiles_resolved: number;
  identity_fragments: number;
  commitments: Record<string, number>;
  avg_extraction_confidence: number;
  total_scored_events: number;
}

interface EventTypeRow { type: string; count: number }
interface SourceRow { source: string; count: number }
interface EntityRow { name: string; label: string; count: number }

const SOURCE_COLORS: Record<string, string> = {
  hubspot: "#f97316",
  zendesk: "#3b82f6",
  nurix: "#10b981",
  salesforce: "#06b6d4",
  zoho: "#a855f7",
  api: "#6b7280",
  sdk: "#8b5cf6",
  raw: "#eab308",
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [eventTypes, setEventTypes] = useState<EventTypeRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("orgId") || "" : "";

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }

    const headers = { "x-org-id": orgId };

    Promise.all([
      fetch("/api/stats", { headers }).then((r) => r.json()),
      fetch("/api/analytics/events", { headers }).then((r) => r.json()).catch(() => ({ rows: [] })),
      fetch("/api/analytics/sources", { headers }).then((r) => r.json()).catch(() => ({ rows: [] })),
      fetch("/api/analytics/entities", { headers }).then((r) => r.json()).catch(() => ({ rows: [] })),
    ]).then(([s, ev, src, ent]) => {
      setStats(s);
      setEventTypes(ev.rows || []);
      setSources(src.rows || []);
      setEntities(ent.rows || []);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, [orgId]);

  const statCards = stats ? [
    { label: "Events Tracked", value: stats.events_tracked.toLocaleString(), color: "text-emerald-400" },
    { label: "Profiles Resolved", value: stats.profiles_resolved.toLocaleString(), color: "text-blue-400" },
    { label: "Identity Fragments", value: stats.identity_fragments.toLocaleString(), color: "text-purple-400" },
    { label: "Avg Confidence", value: `${Math.round((stats.avg_extraction_confidence || 0) * 100)}%`, color: "text-yellow-400" },
    { label: "Open Commitments", value: (stats.commitments?.open || 0).toString(), color: "text-orange-400" },
    { label: "Breached", value: (stats.commitments?.breached || 0).toString(), color: "text-red-400" },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <DashboardHeader orgId={orgId} />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <h2 className="text-lg font-semibold">Decision Analytics</h2>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse h-20 bg-gray-900 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="animate-pulse h-52 bg-gray-900 rounded-xl" />
              <div className="animate-pulse h-52 bg-gray-900 rounded-xl" />
              <div className="animate-pulse h-52 bg-gray-900 rounded-xl" />
              <div className="animate-pulse h-52 bg-gray-900 rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-6 gap-3">
              {statCards.map((s) => (
                <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Event Volume by Type */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Event Volume by Type</h3>
                {eventTypes.length === 0 ? (
                  <EmptyState msg="Ingest events to see breakdown" />
                ) : (
                  <EventVolumeChart data={eventTypes} />
                )}
              </div>

              {/* Commitment Status */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Commitment Status</h3>
                <CommitmentDonut stats={stats?.commitments || {}} />
              </div>

              {/* Source Breakdown */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Events by Source</h3>
                {sources.length === 0 ? (
                  <SourceBreakdownStatic />
                ) : (
                  <SourceBreakdown data={sources} />
                )}
              </div>

              {/* Top Entities */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Top Entities</h3>
                {entities.length === 0 ? (
                  <EmptyState msg="Ingest events to see top entities" />
                ) : (
                  <TopEntities data={entities} />
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-gray-600 text-sm">{msg}</div>
  );
}

function EventVolumeChart({ data }: { data: EventTypeRow[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const colors = ["#10b981", "#3b82f6", "#8b5cf6", "#f97316", "#ef4444", "#06b6d4", "#eab308", "#a855f7"];
  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {data.map((d, i) => (
        <div key={d.type} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-32 truncate capitalize shrink-0">
            {d.type.replace(/_/g, " ")}
          </span>
          <div className="flex-1 bg-gray-800 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all"
              style={{ width: `${(d.count / max) * 100}%`, backgroundColor: colors[i % colors.length] }}
            />
          </div>
          <span className="text-xs text-gray-500 w-10 text-right shrink-0">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

function CommitmentDonut({ stats }: { stats: Record<string, number> }) {
  const items = [
    { label: "Open", count: stats.open || 0, color: "#eab308" },
    { label: "Fulfilled", count: stats.fulfilled || 0, color: "#10b981" },
    { label: "Breached", count: stats.breached || 0, color: "#ef4444" },
  ];
  const total = items.reduce((s, i) => s + i.count, 0);

  if (total === 0) return <EmptyState msg="No commitments tracked yet" />;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-xs text-gray-400 flex-1">{item.label}</span>
          <div className="w-24 bg-gray-800 rounded-full h-2">
            <div
              className="h-2 rounded-full"
              style={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%`, backgroundColor: item.color }}
            />
          </div>
          <span className="text-xs text-gray-400 w-8 text-right">{item.count}</span>
        </div>
      ))}
      <p className="text-xs text-gray-600 mt-2">Total: {total}</p>
    </div>
  );
}

function SourceBreakdown({ data }: { data: SourceRow[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2">
      {data.map((s) => (
        <div key={s.source} className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[s.source] || "#6b7280" }} />
          <span className="text-xs text-gray-400 w-24 truncate capitalize">{s.source}</span>
          <div className="flex-1 bg-gray-800 rounded-full h-2">
            <div
              className="h-2 rounded-full"
              style={{ width: `${(s.count / max) * 100}%`, backgroundColor: SOURCE_COLORS[s.source] || "#6b7280" }}
            />
          </div>
          <span className="text-xs text-gray-500 w-10 text-right">{s.count}</span>
        </div>
      ))}
    </div>
  );
}

function SourceBreakdownStatic() {
  const sources = [
    { source: "API / SDK", color: "#8b5cf6" },
    { source: "HubSpot", color: "#f97316" },
    { source: "Zendesk", color: "#3b82f6" },
    { source: "Nurix Voice", color: "#10b981" },
    { source: "Salesforce", color: "#06b6d4" },
    { source: "Zoho", color: "#a855f7" },
  ];
  return (
    <div className="space-y-2">
      {sources.map((s) => (
        <div key={s.source} className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
          <span className="text-xs text-gray-400 flex-1">{s.source}</span>
          <span className="text-xs text-gray-700">—</span>
        </div>
      ))}
      <p className="text-[10px] text-gray-700 mt-2">Data populates after events are ingested</p>
    </div>
  );
}

function TopEntities({ data }: { data: EntityRow[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const labelColor: Record<string, string> = {
    Product: "#3b82f6",
    Diagnosis: "#ef4444",
    Agent: "#10b981",
    Provider: "#06b6d4",
    Policy: "#8b5cf6",
  };
  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {data.map((d) => (
        <div key={`${d.label}-${d.name}`} className="flex items-center gap-3">
          <span
            className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
            style={{ backgroundColor: `${labelColor[d.label] || "#6b7280"}22`, color: labelColor[d.label] || "#9ca3af" }}
          >
            {d.label}
          </span>
          <span className="text-xs text-gray-400 flex-1 truncate">{d.name}</span>
          <div className="w-16 bg-gray-800 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-emerald-600"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-8 text-right shrink-0">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
