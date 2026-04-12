"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface EventRow {
  profile_id: string;
  profile_name: string;
  email: string;
  city: string;
  tier: string;
  event_id: string;
  event_type: string;
  timestamp: string;
  status: string;
  amount: number | null;
  channel: string;
  confidence: number;
  properties: Record<string, unknown>;
  ingest_source: string;
}

const SOURCE_META: Record<string, { label: string; logo: string | null; color: string }> = {
  hubspot:      { label: "HubSpot",     logo: "/logos/hubspot.svg",     color: "#ff7a59" },
  zendesk:      { label: "Zendesk",     logo: "/logos/zendesk.svg",     color: "#5b8fff" },
  salesforce:   { label: "Salesforce",  logo: "/logos/salesforce.svg",  color: "#00a1e0" },
  zoho:         { label: "Zoho",        logo: null,                      color: "#e42527" },
  nurix:        { label: "Nurix",       logo: null,                      color: "#6366f1" },
  csv_import:   { label: "CSV",         logo: null,                      color: "#10b981" },
  json_import:  { label: "JSON",        logo: null,                      color: "#f59e0b" },
  api:          { label: "API",         logo: null,                      color: "#8b5cf6" },
  webhook:      { label: "Webhook",     logo: null,                      color: "#ec4899" },
};

function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_META[source] || { label: source || "unknown", logo: null, color: "#6b7280" };
  return (
    <div className="flex items-center gap-1.5">
      {meta.logo ? (
        <img src={meta.logo} alt={meta.label} className="w-4 h-4 object-contain" />
      ) : (
        <div className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white"
          style={{ background: meta.color }}>
          {meta.label[0]}
        </div>
      )}
      <span className="text-xs" style={{ color: meta.color }}>{meta.label}</span>
    </div>
  );
}

export default function EventsPage() {
  const { data: session } = useSession({ required: true });
  const router = useRouter();
  const orgId = (session as { orgId?: string })?.orgId || (typeof window !== "undefined" ? localStorage.getItem("orgId") : "") || "";

  const [events, setEvents] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (eventType) params.set("event_type", eventType);
      const res = await fetch(`/api/events/list?${params}`, { headers: { "x-org-id": orgId } });
      const data = await res.json();
      setEvents(data.events || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      if (data.event_types?.length) setEventTypes(data.event_types);
    } finally {
      setLoading(false);
    }
  }, [orgId, page, limit, search, eventType]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const viewInGraph = (profileName: string) => {
    router.push(`/dashboard?q=${encodeURIComponent(profileName || "")}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-gray-900 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">← Dashboard</Link>
            <span className="text-gray-700">/</span>
            <h1 className="text-sm font-semibold text-white">Events</h1>
            {total > 0 && <span className="text-xs text-gray-500">{total.toLocaleString()} total</span>}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-20 pb-4 flex flex-col gap-4" style={{ height: "100vh" }}>
        {/* Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email..."
            className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 w-64"
          />
          {eventTypes.length > 0 && (
            <select
              value={eventType}
              onChange={e => { setEventType(e.target.value); setPage(1); }}
              className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All event types</option>
              {eventTypes.map(et => <option key={et} value={et}>{et}</option>)}
            </select>
          )}
          {loading && <span className="text-xs text-gray-500">Loading...</span>}
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
            <span className="text-xs text-gray-500">{total} events</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Rows per page:</span>
              <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500">
                {[15, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900 z-10">
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Profile</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Event Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Timestamp</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Channel</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <>
                  <tr
                    key={ev.event_id}
                    onClick={() => setExpanded(expanded === ev.event_id ? null : ev.event_id)}
                    className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{ev.profile_name || "—"}</div>
                      {ev.email && <div className="text-xs text-gray-500">{ev.email}</div>}
                      {ev.city && ev.tier && <div className="text-xs text-gray-600">{ev.city} · {ev.tier}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-emerald-900/30 text-emerald-400 rounded text-xs font-mono">
                        {ev.event_type || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{ev.timestamp ? String(ev.timestamp).replace("T", " ").slice(0, 16) : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${ev.status === "completed" ? "bg-emerald-900/30 text-emerald-400" : ev.status === "failed" ? "bg-red-900/30 text-red-400" : "bg-gray-800 text-gray-400"}`}>
                        {ev.status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3"><SourceBadge source={ev.ingest_source} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{ev.channel || "—"}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{ev.amount ? `₹${ev.amount.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden w-16">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((ev.confidence || 0) * 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round((ev.confidence || 0) * 100)}%</span>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expanded === ev.event_id && (
                    <tr key={`${ev.event_id}-expanded`} className="bg-gray-800/30 border-b border-gray-800/50">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Event Details</div>
                            <div className="space-y-1.5 text-sm">
                              <div><span className="text-gray-500">Event ID:</span> <span className="text-gray-300 font-mono text-xs">{ev.event_id}</span></div>
                              <div><span className="text-gray-500">Profile ID:</span> <span className="text-gray-300 font-mono text-xs">{ev.profile_id}</span></div>
                              {ev.properties && typeof ev.properties === "object" && Object.entries(ev.properties).slice(0, 8).map(([k, v]) => (
                                <div key={k}><span className="text-gray-500">{k}:</span> <span className="text-gray-300 text-xs">{String(v ?? "—").slice(0, 100)}</span></div>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Actions</div>
                            <button
                              onClick={e => { e.stopPropagation(); viewInGraph(ev.profile_name || ev.profile_id); }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg transition-colors w-fit"
                            >
                              View in Graph →
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}

              {!loading && events.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-500">
                    No events found. <Link href="/import" className="text-emerald-400 hover:underline">Import data</Link> to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-gray-500">Page {page} of {pages}</span>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg transition-colors">Previous</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg transition-colors">Next</button>
          </div>
        )}
      </main>
    </div>
  );
}
