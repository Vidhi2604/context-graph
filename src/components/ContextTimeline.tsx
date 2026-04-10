"use client";

import { useMemo } from "react";
import { GraphNode } from "@/types/graph";

interface ContextTimelineProps {
  nodes: GraphNode[];
  query: string;
  onEventClick?: (node: GraphNode) => void;
}

const EVENT_COLORS: Record<string, string> = {
  page_view:          "#6b7280",
  product_view:       "#8b5cf6",
  add_to_cart:        "#3b82f6",
  remove_from_cart:   "#6b7280",
  purchase:           "#10b981",
  delivery_scheduled: "#06b6d4",
  delivery_completed: "#10b981",
  return_initiated:   "#f97316",
  return_completed:   "#ef4444",
  refund_issued:      "#eab308",
  support_ticket:     "#f43f5e",
  review_submitted:   "#a855f7",
  visit:              "#3b82f6",
  Emergency:          "#ef4444",
  Inpatient:          "#f97316",
  Outpatient:         "#06b6d4",
  "Follow-up":        "#10b981",
  Surgery:            "#a855f7",
};

function getEventColor(type: string): string {
  return EVENT_COLORS[type] || "#6b7280";
}

function formatTimestamp(ts: string): { date: string; time: string; relative: string } {
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const relative = diffDays === 0 ? "Today"
      : diffDays === 1 ? "Yesterday"
      : diffDays < 7 ? `${diffDays}d ago`
      : diffDays < 30 ? `${Math.floor(diffDays / 7)}w ago`
      : diffDays < 365 ? `${Math.floor(diffDays / 30)}mo ago`
      : `${Math.floor(diffDays / 365)}y ago`;
    return { date, time, relative };
  } catch {
    return { date: "—", time: "—", relative: "—" };
  }
}

function isPersonSearch(nodes: GraphNode[]): boolean {
  const profiles = nodes.filter(n => n.label === "Profile");
  const events = nodes.filter(n => n.label === "Event" || n.label === "Visit");
  return profiles.length <= 3 && events.length > 0;
}

export default function ContextTimeline({ nodes, query, onEventClick }: ContextTimelineProps) {
  const eventNodes = useMemo(() =>
    nodes
      .filter(n => (n.label === "Event" || n.label === "Visit") && n.properties.timestamp)
      .sort((a, b) => String(a.properties.timestamp).localeCompare(String(b.properties.timestamp))),
    [nodes]
  );

  if (eventNodes.length === 0) return null;

  const isPerson = isPersonSearch(nodes);

  return (
    <div className="h-full flex flex-col min-h-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 shrink-0">
        Timeline · {eventNodes.length} events
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {isPerson
          ? <PersonTimeline events={eventNodes} onEventClick={onEventClick} />
          : <AggregateTimeline events={eventNodes} query={query} onEventClick={onEventClick} />
        }
      </div>
    </div>
  );
}

// ── Person Timeline ──────────────────────────────────────────────────

function PersonTimeline({ events, onEventClick }: {
  events: GraphNode[];
  onEventClick?: (node: GraphNode) => void;
}) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-0 bottom-0 w-px bg-gray-800" />

      <div className="space-y-3 pl-8">
        {events.map((evt) => {
          const ts = formatTimestamp(String(evt.properties.timestamp));
          const type = String(evt.properties.event_type || evt.properties.type || evt.label);
          const color = getEventColor(type);
          const amount = evt.properties.amount as number | null | undefined;
          const label = type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

          return (
            <div key={evt.id} className="relative flex items-start gap-0">
              {/* Dot */}
              <div
                className="absolute -left-8 mt-[18px] w-[14px] h-[14px] rounded-full shrink-0 z-10"
                style={{ backgroundColor: color }}
              />

              {/* Card */}
              <button
                onClick={() => onEventClick?.(evt)}
                className="w-full text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl px-4 py-3.5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: type + amount */}
                  <div>
                    <p className="text-sm font-semibold" style={{ color }}>
                      {label}
                    </p>
                    {amount != null && amount > 0 && (
                      <p className="text-sm text-gray-400 mt-0.5">
                        ₹{Number(amount).toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>

                  {/* Right: date / time / relative */}
                  <div className="text-right shrink-0">
                    <p className="text-sm text-gray-300">{ts.date}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{ts.time}</p>
                    <p className="text-xs text-gray-700 mt-0.5">{ts.relative}</p>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Aggregate Timeline ───────────────────────────────────────────────

function AggregateTimeline({ events, onEventClick }: {
  events: GraphNode[];
  query?: string;
  onEventClick?: (node: GraphNode) => void;
}) {
  const byDate = useMemo(() => {
    const map: Record<string, GraphNode[]> = {};
    for (const evt of events) {
      const date = String(evt.properties.timestamp).slice(0, 10);
      if (!map[date]) map[date] = [];
      map[date].push(evt);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  // Event type breakdown
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const evt of events) {
      const type = String(evt.properties.event_type || evt.properties.type || evt.label || "unknown");
      counts[type] = (counts[type] || 0) + 1;
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [events]);

  const maxCount = Math.max(...byDate.map(([, evts]) => evts.length), 1);
  const avgPerDay = events.length / Math.max(byDate.length, 1);

  return (
    <div className="flex flex-col">
      {/* Summary row */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {typeCounts.map(([type, count]) => (
            <span
              key={type}
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${getEventColor(type)}22`, color: getEventColor(type) }}
            >
              {type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} {count}
            </span>
          ))}
        </div>
        <span className="text-[10px] text-gray-600 shrink-0 ml-2">{events.length} · {byDate.length}d</span>
      </div>

      {/* Bar chart rows */}
      <div className="relative">
        <div className="absolute left-[11px] top-0 bottom-0 w-px bg-gray-800" />

        <div className="space-y-2 pl-8">
          {byDate.map(([date, dayEvents]) => {
            const d = new Date(date);
            const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
            const barPct = Math.max(8, (dayEvents.length / maxCount) * 100);
            const hasSpike = dayEvents.length > avgPerDay * 1.5 && avgPerDay > 0;
            const topType = String(dayEvents[0]?.properties.event_type || dayEvents[0]?.properties.type || "visit");
            const barColor = hasSpike ? "#ef4444" : getEventColor(topType);
            const topAmount = dayEvents.reduce((s, e) => s + (Number(e.properties.amount) || 0), 0);

            return (
              <div key={date} className="relative flex items-start gap-0">
                {/* Dot */}
                <div
                  className="absolute -left-8 mt-[10px] w-[10px] h-[10px] rounded-full shrink-0 z-10"
                  style={{ backgroundColor: barColor }}
                />

                {/* Card */}
                <button
                  onClick={() => dayEvents[0] && onEventClick?.(dayEvents[0])}
                  className="w-full text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl px-4 py-3 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Bar */}
                      <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${barPct}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{dayEvents.length} event{dayEvents.length > 1 ? "s" : ""}</span>
                        {hasSpike && <span className="text-[10px] text-red-400">↑ spike</span>}
                        {topAmount > 0 && (
                          <span className="text-[10px] text-gray-600">₹{(topAmount / 1000).toFixed(0)}k</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-gray-300">{label}</p>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
