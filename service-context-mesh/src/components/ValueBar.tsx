"use client";

import Link from "next/link";

interface ValueBarProps {
  stats: {
    events_tracked: number;
    profiles_resolved: number;
    identity_fragments: number;
    commitments: Record<string, number>;
    avg_extraction_confidence: number;
  } | null;
}

export default function ValueBar({ stats }: ValueBarProps) {
  if (!stats) return null;

  const cards = [
    { label: "Events Tracked", value: (stats.events_tracked ?? 0).toLocaleString() },
    { label: "Profiles Resolved", value: (stats.profiles_resolved ?? 0).toString() },
    { label: "Identities Merged", value: (stats.identity_fragments ?? 0).toString() },
    {
      label: "Commitments",
      value: `${stats.commitments?.open || 0}/${stats.commitments?.fulfilled || 0}/${stats.commitments?.breached || 0}`,
      sub: "O/F/B",
    },
    {
      label: "Avg Confidence",
      value: stats.avg_extraction_confidence
        ? `${Math.round(stats.avg_extraction_confidence * 100)}%`
        : "—",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {cards.map((card) => {
        const inner = (
          <>
            <div className="text-2xl font-bold text-white tracking-tight">{card.value}</div>
            <div className="text-xs text-gray-400 mt-0.5 font-medium">
              {card.label}
              {card.sub && <span className="ml-1 text-gray-500">({card.sub})</span>}
            </div>
          </>
        );
        if (card.label === "Events Tracked") {
          return (
            <Link key={card.label} href="/dashboard/events"
              className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center hover:border-emerald-700 hover:bg-gray-800/60 transition-all cursor-pointer">
              {inner}
            </Link>
          );
        }
        if (card.label === "Profiles Resolved") {
          return (
            <Link key={card.label} href="/dashboard/profiles"
              className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center hover:border-emerald-700 hover:bg-gray-800/60 transition-all cursor-pointer">
              {inner}
            </Link>
          );
        }
        return (
          <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
