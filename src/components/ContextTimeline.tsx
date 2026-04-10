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
  // Healthcare
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

// Detect if search is for a specific person vs aggregate
function isPersonSearch(nodes: GraphNode[]): boolean {
  const profiles = nodes.filter(n => n.label === "Profile");
  const events = nodes.filter(n => n.label === "Event" || n.label === "Visit");
  // If ≤3 profiles and has events — specific person search
  return profiles.length <= 3 && events.length > 0;
}

export default function ContextTimeline({ nodes, query, onEventClick }: ContextTimelineProps) {
  const eventNodes = useMemo(() =>
    nodes
      .filter(n => (n.label === "Event" || n.label === "Visit") && n.properties.timestamp)
      .sort((a, b) => {
        const ta = String(a.properties.timestamp);
        const tb = String(b.properties.timestamp);
        return ta.localeCompare(tb);
      }),
    [nodes]
  );

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    nodes.filter(n => n.label === "Profile").forEach(p => { map[p.id] = p.displayName; });
    return map;
  }, [nodes]);

  if (eventNodes.length === 0) return null;

  const isPerson = isPersonSearch(nodes);

  if (isPerson) {
    return <PersonTimeline events={eventNodes} profileMap={profileMap} onEventClick={onEventClick} />;
  }

  return <AggregateTimeline events={eventNodes} query={query} onEventClick={onEventClick} />;
}

// ── Individual timeline (specific person) ────────────────────────

function PersonTimeline({
  events,
  onEventClick,
}: {
  events: GraphNode[];
  profileMap?: Record<string, string>;
  onEventClick?: (node: GraphNode) => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Timeline</h3>
      <div className="relative pl-4 space-y-0 max-h-[560px] overflow-y-auto pr-1">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-800" />

        {events.map((evt) => {
          const ts = formatTimestamp(String(evt.properties.timestamp));
          const type = String(evt.properties.event_type || evt.properties.type || evt.label);
          const color = getEventColor(type);
          const amount = evt.properties.amount as number | null | undefined;
          const isBreached = Boolean(evt.properties.exception || evt.properties.deviated);
          const confidence = evt.properties.confidence_score as number | undefined;

          return (
            <div key={evt.id} className="relative flex gap-3 group">
              {/* Dot */}
              <div
                className="relative z-10 w-3.5 h-3.5 rounded-full border-2 border-gray-950 mt-2 shrink-0 cursor-pointer group-hover:scale-125 transition-transform"
                style={{ backgroundColor: isBreached ? "#ef4444" : color }}
              />

              {/* Content */}
              <button
                onClick={() => onEventClick?.(evt)}
                className="flex-1 text-left bg-gray-900/50 hover:bg-gray-800/80 border border-gray-800/50 rounded-lg px-3 py-2 mb-2 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-xs font-medium capitalize"
                        style={{ color }}
                      >
                        {type.replace(/_/g, " ")}
                      </span>
                      {isBreached && (
                        <span className="text-[9px] bg-red-900/40 text-red-400 px-1 rounded">exception</span>
                      )}
                    </div>
                    {amount && (
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        ₹{Number(amount).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-gray-400">{ts.date}</div>
                    <div className="text-[10px] text-gray-600">{ts.time}</div>
                    <div className="text-[9px] text-gray-700">{ts.relative}</div>
                  </div>
                </div>
                {confidence != null && (
                  <div className="text-[9px] text-gray-700 mt-1">
                    confidence: {Math.round(confidence * 100)}%
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Aggregate timeline (category/product search) ─────────────────

function AggregateTimeline({
  events,
  onEventClick,
}: {
  events: GraphNode[];
  query?: string;
  onEventClick?: (node: GraphNode) => void;
}) {
  // Group by date
  const byDate = useMemo(() => {
    const map: Record<string, GraphNode[]> = {};
    for (const evt of events) {
      const ts = String(evt.properties.timestamp);
      const date = ts.slice(0, 10);
      if (!map[date]) map[date] = [];
      map[date].push(evt);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  const maxCount = Math.max(...byDate.map(([, evts]) => evts.length), 1);
  const totalAmount = events.reduce((s, e) => s + (Number(e.properties.amount) || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Timeline</h3>
        <span className="text-[10px] text-gray-600">{events.length} events</span>
      </div>

      {totalAmount > 0 && (
        <div className="text-xs text-gray-500 bg-gray-900 rounded-lg px-3 py-1.5">
          Total: <span className="text-white font-medium">₹{totalAmount.toLocaleString()}</span>
        </div>
      )}

      <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
        {byDate.map(([date, dayEvents]) => {
          const d = new Date(date);
          const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          const dayAmount = dayEvents.reduce((s, e) => s + (Number(e.properties.amount) || 0), 0);
          const barWidth = Math.max(4, (dayEvents.length / maxCount) * 100);
          const hasSpike = dayEvents.length > (events.length / byDate.length) * 1.5;

          return (
            <div key={date} className="flex items-center gap-2 group">
              {/* Date */}
              <div className="text-[10px] text-gray-500 w-14 shrink-0 text-right font-mono">{label}</div>

              {/* Bar */}
              <div className="flex-1 relative">
                <div
                  className="h-5 rounded transition-all cursor-pointer hover:opacity-90"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: hasSpike ? "#ef4444" : "#3b82f6",
                    minWidth: "4px",
                  }}
                  onClick={() => dayEvents[0] && onEventClick?.(dayEvents[0])}
                />
              </div>

              {/* Count + spike indicator */}
              <div className="flex items-center gap-1 w-20 shrink-0">
                <span className="text-[10px] text-gray-400">{dayEvents.length}</span>
                {hasSpike && <span className="text-[9px] text-red-400">↑ spike</span>}
                {dayAmount > 0 && (
                  <span className="text-[9px] text-gray-600">₹{(dayAmount/1000).toFixed(0)}k</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
