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

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ["#3b82f6","#10b981","#8b5cf6","#f97316","#ec4899","#14b8a6","#eab308","#a855f7","#06b6d4","#f43f5e"];
  return colors[Math.abs(hash) % colors.length];
}

function getEventColor(type: string): string {
  return EVENT_COLORS[type] || hashColor(type);
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
  const events = nodes.filter(n => n.properties.timestamp && n.label !== "Profile" && n.label !== "Identity");
  return profiles.length <= 3 && events.length > 0;
}

export default function ContextTimeline({ nodes, query, onEventClick }: ContextTimelineProps) {
  const eventNodes = useMemo(() =>
    nodes
      .filter(n => n.properties.timestamp && n.label !== "Profile" && n.label !== "Identity")
      .sort((a, b) => String(a.properties.timestamp).localeCompare(String(b.properties.timestamp))),
    [nodes]
  );

  if (eventNodes.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Timeline</p>
      <p className="text-gray-600 text-sm">No events found</p>
      <p className="text-gray-700 text-xs mt-1">Events will appear here once ingested</p>
    </div>
  );

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
      {/* Vertical line — centered in the 24px dot column */}
      <div className="absolute left-[11px] top-0 bottom-0 w-px bg-gray-800" />

      <div className="space-y-3">
        {events.map((evt) => {
          const ts = formatTimestamp(String(evt.properties.timestamp));
          const type = String(evt.properties.event_type || evt.properties.type || evt.label);
          const isCall = type === 'support_call' || type === 'call' || evt.properties.direction;
          const color = isCall
            ? (evt.properties.outcome === 'completed' ? '#10b981'
              : evt.properties.outcome === 'transferred' ? '#f59e0b'
              : evt.properties.outcome === 'dropped' || evt.properties.outcome === 'failed' ? '#ef4444'
              : '#6b7280')
            : getEventColor(type);
          const amount = evt.properties.amount as number | null | undefined;
          const label = isCall
            ? (evt.displayName || type.replace(/_/g, " "))
            : type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

          // Nurix call-specific fields
          const direction = evt.properties.direction as string | undefined;
          const duration = evt.properties.duration_formatted as string || (evt.properties.duration ? `${Math.round(Number(evt.properties.duration) / 60)}m` : null);
          const sentiment = evt.properties.sentiment as string | undefined;
          const outcome = evt.properties.outcome as string | undefined;
          const transferred = evt.properties.transferred as boolean | undefined;
          const summary = evt.properties.summary as string | undefined;
          const agent = evt.properties.agent as string | undefined;

          const OUTCOME_ICON: Record<string, string> = { completed: '✓', transferred: '↗', dropped: '✕', follow_up_needed: '!', failed: '✗', in_progress: '…' };
          const SENTIMENT_COLOR: Record<string, string> = { positive: '#10b981', neutral: '#6b7280', negative: '#ef4444' };

          return (
            <div key={evt.id} className="flex items-start gap-3">
              <div className="w-6 shrink-0 flex justify-center mt-[14px] relative z-10">
                <div className="w-[14px] h-[14px] rounded-full" style={{ backgroundColor: color }} />
              </div>

              <button
                onClick={() => onEventClick?.(evt)}
                className="flex-1 text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl px-4 py-3.5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color }}>
                      {isCall && direction && <span className="text-xs font-normal text-gray-500 mr-1">{direction === 'outbound' ? '↑ OB' : '↓ IB'}</span>}
                      {isCall ? (agent || label) : label}
                    </p>

                    {/* Call badges */}
                    {isCall && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {outcome && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${color}22`, color }}>
                            {String(OUTCOME_ICON[outcome] || '')} {outcome.replace(/_/g, ' ')}
                          </span>
                        )}
                        {sentiment && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800" style={{ color: String(SENTIMENT_COLOR[sentiment] || '#6b7280') }}>
                            {sentiment}
                          </span>
                        )}
                        {transferred && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400">transferred</span>
                        )}
                        {duration && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">⏱ {duration}</span>
                        )}
                      </div>
                    )}

                    {/* Summary snippet */}
                    {isCall && summary && (
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{summary}</p>
                    )}

                    {!isCall && amount != null && amount > 0 && (
                      <p className="text-sm text-gray-400 mt-0.5">₹{Number(amount).toLocaleString("en-IN")}</p>
                    )}
                  </div>

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

        <div className="space-y-2">
          {byDate.map(([date, dayEvents]) => {
            const d = new Date(date);
            const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
            const barPct = Math.max(8, (dayEvents.length / maxCount) * 100);
            const hasSpike = dayEvents.length > avgPerDay * 1.5 && avgPerDay > 0;
            const topType = String(dayEvents[0]?.properties.event_type || dayEvents[0]?.properties.type || "visit");
            const barColor = hasSpike ? "#ef4444" : getEventColor(topType);
            const topAmount = dayEvents.reduce((s, e) => s + (Number(e.properties.amount) || 0), 0);

            return (
              <div key={date} className="flex items-start gap-3">
                {/* Dot column — centered on the line */}
                <div className="w-6 shrink-0 flex justify-center mt-[12px] relative z-10">
                  <div
                    className="w-[10px] h-[10px] rounded-full"
                    style={{ backgroundColor: barColor }}
                  />
                </div>

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
