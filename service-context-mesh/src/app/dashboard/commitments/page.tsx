"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import DashboardHeader from "@/components/DashboardHeader";

interface CommitmentRow {
  id: string;
  promise: string;
  deadline: string;
  status: string;
  assignee: string;
  customer_name: string;
  profile_id: string;
  confidence: number;
}

interface Counts {
  all: number;
  open: number;
  breached: number;
  fulfilled: number;
}

export default function CommitmentsPage() {
  const [commitments, setCommitments] = useState<CommitmentRow[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, open: 0, breached: 0, fulfilled: 0 });
  const [filter, setFilter] = useState<"all" | "open" | "breached" | "fulfilled">("all");
  const [loading, setLoading] = useState(true);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("orgId") || "" : "";

  const fetchCommitments = useCallback((status: string) => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);

    const url = status === "all" ? "/api/commitments" : `/api/commitments?status=${status}`;
    fetch(url, { headers: { "x-org-id": orgId } })
      .then((r) => r.json())
      .then((data) => {
        setCommitments(data.commitments || []);
        if (data.counts) setCounts(data.counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => { fetchCommitments(filter); }, [filter, fetchCommitments]);

  const statusMeta = {
    all: { label: "All", color: "text-gray-400", bg: "bg-gray-800", border: "border-gray-700" },
    open: { label: "Open", color: "text-yellow-400", bg: "bg-yellow-900/20", border: "border-yellow-800/40" },
    breached: { label: "Breached", color: "text-red-400", bg: "bg-red-900/20", border: "border-red-800/40" },
    fulfilled: { label: "Fulfilled", color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-800/40" },
  };

  const dotColor = (s: string) =>
    s === "breached" ? "bg-red-400" :
    s === "fulfilled" ? "bg-emerald-400" :
    s === "open" ? "bg-yellow-400" : "bg-gray-400";

  const deadlineLabel = (dl: string) => {
    if (!dl) return null;
    try {
      const d = new Date(dl);
      const now = new Date();
      const diff = d.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      if (days < 0) return { text: `${Math.abs(days)}d overdue`, red: true };
      if (days === 0) return { text: "Due today", red: true };
      if (days <= 3) return { text: `Due in ${days}d`, red: true };
      return {
        text: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        red: false,
      };
    } catch { return null; }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <DashboardHeader orgId={orgId} />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Commitment Tracking</h2>
          {counts.breached > 0 && (
            <span className="text-xs bg-red-900/30 border border-red-800/40 text-red-400 px-3 py-1 rounded-lg">
              {counts.breached} breached
            </span>
          )}
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-4 gap-3">
          {(["all", "open", "breached", "fulfilled"] as const).map((s) => {
            const m = statusMeta[s];
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-xl px-4 py-4 border text-left transition-all ${
                  filter === s
                    ? `${m.bg} ${m.border}`
                    : "bg-gray-900 border-gray-800 hover:border-gray-700"
                }`}
              >
                <div className={`text-2xl font-bold ${m.color}`}>{counts[s]}</div>
                <div className="text-xs text-gray-500 mt-1 capitalize">{m.label}</div>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse h-16 bg-gray-900 rounded-xl" />
            ))}
          </div>
        ) : commitments.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500">
              {filter === "all"
                ? "No commitments tracked yet."
                : `No ${filter} commitments.`}
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Commitments are automatically extracted from events and voice transcripts.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {commitments.map((c) => {
              const dl = deadlineLabel(c.deadline);
              return (
                <div
                  key={c.id}
                  className={`bg-gray-900 border rounded-xl px-5 py-4 flex items-center gap-4 transition-colors hover:bg-gray-900/80 ${
                    c.status === "breached" ? "border-red-800/40" :
                    c.status === "fulfilled" ? "border-emerald-800/40" :
                    "border-gray-800"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor(c.status)}`} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.promise}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                      {c.customer_name && (
                        <Link
                          href={`/dashboard?query=${encodeURIComponent(c.customer_name)}`}
                          className="text-emerald-400 hover:underline"
                        >
                          {c.customer_name}
                        </Link>
                      )}
                      {c.assignee && <span>→ {c.assignee}</span>}
                      {c.confidence > 0 && (
                        <span className="text-gray-700">{Math.round(c.confidence * 100)}% conf</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    {dl && (
                      <span className={`text-xs font-mono ${dl.red ? "text-red-400" : "text-gray-400"}`}>
                        {dl.text}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded capitalize ${
                      c.status === "breached" ? "bg-red-900/30 text-red-400" :
                      c.status === "fulfilled" ? "bg-emerald-900/30 text-emerald-400" :
                      c.status === "open" ? "bg-yellow-900/30 text-yellow-400" :
                      "bg-gray-800 text-gray-400"
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
