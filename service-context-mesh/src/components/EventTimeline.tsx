"use client";

import { TimelineEntry, GraphNode } from "@/types/graph";

interface EventTimelineProps {
  timeline: TimelineEntry[];
  onEventClick?: (node: GraphNode) => void;
}

export default function EventTimeline({ timeline, onEventClick }: EventTimelineProps) {
  if (timeline.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
        Timeline
      </h3>
      <div className="space-y-1 max-h-[460px] overflow-y-auto pr-2">
        {timeline.map((entry) => (
          <div key={entry.date} className="flex items-start gap-3">
            <div className="text-xs text-gray-600 font-mono w-20 pt-1 shrink-0">
              {formatDate(entry.date)}
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
            <div className="flex-1 space-y-1">
              {entry.events.map((evt) => (
                <button
                  key={evt.id}
                  onClick={() => onEventClick?.(evt)}
                  className="w-full text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-3 py-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: evt.color }}
                    />
                    <span className="text-xs font-medium capitalize flex-1">
                      {String(evt.properties.event_type || evt.properties.type || evt.label).replace(/_/g, " ")}
                    </span>
                    {evt.properties.confidence_score != null && (
                      <span className="text-[10px] text-blue-400 font-mono">
                        {Math.round(Number(evt.properties.confidence_score) * 100)}%
                      </span>
                    )}
                    {evt.relevance != null && (
                      <span className="text-[10px] text-gray-500 font-mono">
                        rel: {Math.round(evt.relevance * 100)}
                      </span>
                    )}
                  </div>
                  {evt.properties.amount != null && (
                    <span className="text-[10px] text-gray-500 ml-4">
                      Rs.{Number(evt.properties.amount).toLocaleString()}
                    </span>
                  )}
                </button>
              ))}
              {entry.count > 1 && (
                <div className="text-[10px] text-gray-600 ml-4">
                  {entry.count} events · Rs.{entry.totalAmount.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}
