"use client";

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
    { label: "Events Tracked", value: stats.events_tracked.toLocaleString() },
    { label: "Profiles Resolved", value: stats.profiles_resolved.toString() },
    { label: "Identities Merged", value: stats.identity_fragments.toString() },
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
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-center"
        >
          <div className="text-lg font-bold text-white">{card.value}</div>
          <div className="text-[10px] text-gray-500">
            {card.label}
            {card.sub && <span className="ml-1 text-gray-600">({card.sub})</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
