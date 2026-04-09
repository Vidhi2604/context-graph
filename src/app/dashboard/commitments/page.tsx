"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function CommitmentsPage() {
  const [commitments] = useState<CommitmentRow[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "breached" | "fulfilled">("all");
  const [loading, setLoading] = useState(true);
  const orgId = typeof window !== "undefined" ? localStorage.getItem("orgId") || "" : "";

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    // TODO: dedicated commitments list endpoint
    setLoading(false);
  }, [orgId]);

  const filtered = filter === "all"
    ? commitments
    : commitments.filter((c) => c.status === filter);

  const counts = {
    all: commitments.length,
    open: commitments.filter((c) => c.status === "open").length,
    breached: commitments.filter((c) => c.status === "breached").length,
    fulfilled: commitments.filter((c) => c.status === "fulfilled").length,
  };

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
            <Link href="/dashboard/agents" className="px-3 py-1 rounded text-gray-400 hover:text-white">Agents</Link>
            <Link href="/dashboard/commitments" className="px-3 py-1 rounded bg-gray-800 text-white">Commitments</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold mb-6">Commitment Tracking</h2>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(["all", "open", "breached", "fulfilled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? f === "breached"
                    ? "bg-red-900/30 text-red-400 border border-red-800"
                    : "bg-gray-800 text-white border border-gray-700"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1 text-gray-600">({counts[f]})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="animate-pulse h-64 bg-gray-900 rounded-xl" />
        ) : filtered.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500">No commitments tracked yet.</p>
            <p className="text-xs text-gray-600 mt-2">
              Commitments are automatically extracted from events and transcripts.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <div
                key={c.id}
                className={`bg-gray-900 border rounded-xl px-5 py-4 flex items-center gap-4 ${
                  c.status === "breached"
                    ? "border-red-800/50"
                    : c.status === "fulfilled"
                      ? "border-emerald-800/50"
                      : "border-gray-800"
                }`}
              >
                {/* Status indicator */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  c.status === "breached" ? "bg-red-400" :
                  c.status === "fulfilled" ? "bg-emerald-400" :
                  c.status === "open" ? "bg-yellow-400" : "bg-gray-400"
                }`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.promise}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>
                      {c.customer_name && (
                        <Link
                          href={`/dashboard?query=${encodeURIComponent(c.customer_name)}`}
                          className="text-emerald-400 hover:underline"
                        >
                          {c.customer_name}
                        </Link>
                      )}
                    </span>
                    {c.assignee && <span>Assigned: {c.assignee}</span>}
                  </div>
                </div>

                {/* Deadline */}
                <div className="text-right shrink-0">
                  {c.deadline && (
                    <p className={`text-xs font-mono ${
                      c.status === "breached" ? "text-red-400" : "text-gray-400"
                    }`}>
                      {new Date(c.deadline).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded ${
                    c.status === "breached" ? "bg-red-900/30 text-red-400" :
                    c.status === "fulfilled" ? "bg-emerald-900/30 text-emerald-400" :
                    c.status === "open" ? "bg-yellow-900/30 text-yellow-400" :
                    "bg-gray-800 text-gray-400"
                  }`}>
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
