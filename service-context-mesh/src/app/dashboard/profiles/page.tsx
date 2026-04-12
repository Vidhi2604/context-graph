"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Profile {
  profile_id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  tier: string;
  ltv: number | null;
  created_at: string;
  event_count: number;
  sources: string[];
}

const SOURCE_META: Record<string, { label: string; logo: string | null; color: string }> = {
  hubspot:      { label: "HubSpot",    logo: "/logos/hubspot.svg",    color: "#ff7a59" },
  zendesk:      { label: "Zendesk",    logo: "/logos/zendesk.svg",    color: "#5b8fff" },
  salesforce:   { label: "Salesforce", logo: "/logos/salesforce.svg", color: "#00a1e0" },
  zoho:         { label: "Zoho",       logo: null,                     color: "#e42527" },
  nurix:        { label: "Nurix",      logo: null,                     color: "#6366f1" },
  csv_import:   { label: "CSV",        logo: null,                     color: "#10b981" },
  json_import:  { label: "JSON",       logo: null,                     color: "#f59e0b" },
  api:          { label: "API",        logo: null,                     color: "#8b5cf6" },
  webhook:      { label: "Webhook",    logo: null,                     color: "#ec4899" },
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


export default function ProfilesPage() {
  const { data: session } = useSession({ required: true });
  const router = useRouter();
  const orgId = (session as { orgId?: string })?.orgId || (typeof window !== "undefined" ? localStorage.getItem("orgId") : "") || "";

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchProfiles = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/profiles/list?${params}`, { headers: { "x-org-id": orgId } });
      const data = await res.json();
      setProfiles(data.profiles || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } finally {
      setLoading(false);
    }
  }, [orgId, page, limit, search]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-gray-900 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">← Dashboard</Link>
            <span className="text-gray-700">/</span>
            <h1 className="text-sm font-semibold">Profiles</h1>
            {total > 0 && <span className="text-xs text-gray-500">{total.toLocaleString()} total</span>}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-20 pb-4 flex flex-col gap-4" style={{ height: "100vh" }}>
        <div className="flex gap-3 items-center">
          <input type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email, city..."
            className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 w-72"
          />
          {loading && <span className="text-xs text-gray-500">Loading...</span>}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
            <span className="text-xs text-gray-500">{total} profiles</span>
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
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sources</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Events</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => (
                <tr key={p.profile_id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{p.name || "—"}</div>
                    <div className="text-xs text-gray-600 font-mono">{String(p.profile_id || "").slice(0, 12)}…</div>
                  </td>
                  <td className="px-4 py-3">
                    {p.email && <div className="text-xs text-gray-400">{p.email}</div>}
                    {p.phone && <div className="text-xs text-gray-500">{p.phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(p.sources || []).filter(Boolean).map(s => (
                        <SourceBadge key={s} source={s} />
                      ))}
                      {(!p.sources || p.sources.filter(Boolean).length === 0) && (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-emerald-400 font-semibold">{p.event_count ?? 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => router.push(`/dashboard?q=${encodeURIComponent(p.name || p.profile_id)}`)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && profiles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-500">
                    No profiles found. <Link href="/import" className="text-emerald-400 hover:underline">Import data</Link> to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

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
