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
    { label: "Events Tracked", value: (stats.events_tracked ?? 0).toLocaleString(), href: "/dashboard/events" },
    { label: "Profiles Resolved", value: (stats.profiles_resolved ?? 0).toLocaleString(), href: "/dashboard/profiles" },
    { label: "Identities Merged", value: (stats.identity_fragments ?? 0).toLocaleString(), href: null },
    {
      label: "Commitments (Open/Done/Missed)",
      value: `${stats.commitments?.open || 0}/${stats.commitments?.fulfilled || 0}/${stats.commitments?.breached || 0}`,
      href: null,
    },
    {
      label: "Avg Confidence",
      value: stats.avg_extraction_confidence ? `${Math.round(stats.avg_extraction_confidence * 100)}%` : "—",
      href: null,
    },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {cards.map((card) => {
        const content = (
          <>
            <div className="text-xl font-bold tracking-tight whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
              {card.value}
            </div>
            <div className="text-xs font-medium whitespace-nowrap mt-0.5" style={{ color: "var(--text-muted)" }}>
              {card.label}
            </div>
          </>
        );

        const cls = "flex-1 min-w-[120px] theme-card px-4 py-3 text-center transition-all";

        return card.href ? (
          <Link key={card.label} href={card.href} className={`${cls} theme-card-hover`}>
            {content}
          </Link>
        ) : (
          <div key={card.label} className={cls}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
