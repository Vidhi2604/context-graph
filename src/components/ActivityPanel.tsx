"use client";

import { useEffect, useRef, useState } from "react";
import type { ActivityEntry, ActivityLayer } from "@/lib/activity-log";

const LAYER_COLOR: Record<ActivityLayer, string> = {
  auth:    "#6b7280",
  ingest:  "#f97316",
  redis:   "#f59e0b",
  process: "#3b82f6",
  llm:     "#8b5cf6",
  neo4j:   "#10b981",
  mapping: "#06b6d4",
  scoring: "#14b8a6",
  insight: "#ec4899",
};

const LAYER_LABEL: Record<ActivityLayer, string> = {
  auth:    "Auth",
  ingest:  "Ingest",
  redis:   "Redis",
  process: "Process",
  llm:     "LLM",
  neo4j:   "Neo4j",
  mapping: "Mapping",
  scoring: "Scoring",
  insight: "Insight",
};

const STATUS_ICON: Record<string, string> = {
  running: "⟳",
  success: "✓",
  error:   "✕",
  skipped: "—",
};

interface Props {
  orgId: string;
  resetKey?: number;
  onClose: () => void;
}

// Group entries into "pipelines" — bursts of activity within 5s of each other
interface Pipeline {
  id: string;
  entries: ActivityEntry[];
  startedAt: number;
}

function groupIntoPipelines(entries: ActivityEntry[]): Pipeline[] {
  if (!entries.length) return [];

  const sorted = [...entries].sort((a, b) => a.started_at - b.started_at);
  const pipelines: Pipeline[] = [];
  let current: Pipeline = { id: sorted[0].id, entries: [sorted[0]], startedAt: sorted[0].started_at };

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    // New pipeline if gap > 5s
    if (curr.started_at - prev.started_at > 5000) {
      pipelines.push(current);
      current = { id: curr.id, entries: [curr], startedAt: curr.started_at };
    } else {
      current.entries.push(curr);
    }
  }
  pipelines.push(current);
  return pipelines.reverse(); // newest first
}

// Within a pipeline, find parallel steps (overlapping timestamps)
function buildRows(entries: ActivityEntry[]): ActivityEntry[][] {
  const sorted = [...entries].sort((a, b) => a.started_at - b.started_at);
  const rows: ActivityEntry[][] = [];

  for (const entry of sorted) {
    // Find a row where last entry has ended before this one starts
    const rowIdx = rows.findIndex(row => {
      const last = row[row.length - 1];
      return !last.ended_at || last.ended_at <= entry.started_at;
    });
    if (rowIdx === -1) {
      rows.push([entry]);
    } else {
      rows[rowIdx].push(entry);
    }
  }
  return rows;
}

export default function ActivityPanel({ orgId, resetKey, onClose }: Props) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const sinceRef = useRef<number>(0);

  useEffect(() => {
    setEntries([]);
    sinceRef.current = Date.now();
  }, [resetKey]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/debug/activity?since=${sinceRef.current}`, {
          headers: { "x-org-id": orgId },
        });
        if (!res.ok) return;
        const data = await res.json() as { entries: ActivityEntry[]; ts: number };
        if (data.entries.length > 0) {
          setEntries(prev => {
            const merged = [...prev, ...data.entries];
            // Keep last 200
            return merged.slice(-200);
          });
          sinceRef.current = data.ts;
          // Auto-scroll
          requestAnimationFrame(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
          });
        }
      } catch { /* silent */ }
    }

    poll();
    const interval = setInterval(poll, 1000);
    return () => { stopped = true; clearInterval(interval); void stopped; };
  }, [orgId]);

  const pipelines = groupIntoPipelines(entries);

  return (
    <div className="fixed right-0 top-0 h-full w-[460px] bg-gray-900 border-l border-gray-800 flex flex-col z-40">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Activity Log</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 animate-pulse">
              live
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">Chronological · branches = parallel steps</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEntries([]); sinceRef.current = 0; }}
            className="text-[10px] text-gray-600 hover:text-gray-400"
          >
            clear
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-white">&times;</button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-gray-800 flex flex-wrap gap-x-3 gap-y-1 shrink-0">
        {(Object.keys(LAYER_COLOR) as ActivityLayer[]).map(layer => (
          <span key={layer} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LAYER_COLOR[layer] }} />
            {LAYER_LABEL[layer]}
          </span>
        ))}
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-4">
        {pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm gap-2">
            <span className="text-2xl">⬡</span>
            <span>Waiting for activity…</span>
            <span className="text-[10px]">Run a search or trigger an ingest</span>
          </div>
        ) : (
          pipelines.map(pipeline => (
            <PipelineBlock key={pipeline.id} pipeline={pipeline} />
          ))
        )}
      </div>
    </div>
  );
}

function PipelineBlock({ pipeline }: { pipeline: Pipeline }) {
  const rows = buildRows(pipeline.entries);
  const isParallel = rows.length > 1;
  const time = new Date(pipeline.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="space-y-0.5">
      {/* Timestamp */}
      <div className="text-[10px] text-gray-600 font-mono mb-1">{time}</div>

      {isParallel ? (
        // Branching layout
        <div className="flex gap-2 relative">
          {/* Vertical join lines */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-800" />
          {rows.map((row, ri) => (
            <div key={ri} className="flex-1 space-y-0.5 pl-2">
              {row.map(entry => <EntryCard key={entry.id} entry={entry} />)}
            </div>
          ))}
        </div>
      ) : (
        // Linear layout
        <div className="space-y-0.5">
          {rows[0]?.map(entry => <EntryCard key={entry.id} entry={entry} />)}
        </div>
      )}
    </div>
  );
}

function EntryCard({ entry }: { entry: ActivityEntry }) {
  const [expanded, setExpanded] = useState(false);
  const color = LAYER_COLOR[entry.layer];
  const icon = STATUS_ICON[entry.status] || "·";
  const isRunning = entry.status === "running";

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
        expanded ? "border-gray-600 bg-gray-800/60" : "border-gray-800 bg-gray-900 hover:bg-gray-800/40"
      } ${entry.status === "error" ? "border-red-900/50" : ""}`}
    >
      <div className="flex items-center gap-2">
        {/* Layer dot */}
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? "animate-pulse" : ""}`}
          style={{ backgroundColor: color }}
        />

        {/* Label */}
        <span className={`text-xs flex-1 truncate ${entry.status === "skipped" ? "text-gray-600" : "text-white"}`}>
          {entry.label}
        </span>

        {/* Duration / status */}
        <span className={`text-[10px] font-mono shrink-0 ${
          entry.status === "error" ? "text-red-400" :
          entry.status === "running" ? "text-yellow-400" :
          entry.duration_ms !== undefined
            ? entry.duration_ms < 100 ? "text-emerald-400"
            : entry.duration_ms < 500 ? "text-yellow-400"
            : "text-red-400"
            : "text-gray-600"
        }`}>
          {isRunning ? "…" : entry.duration_ms !== undefined ? `${entry.duration_ms}ms` : "—"}
        </span>

        <span className="text-[10px] shrink-0">
          {isRunning ? (
            <span className="text-yellow-400 animate-pulse">⟳</span>
          ) : entry.status === "success" ? (
            <span className="text-emerald-400">{icon}</span>
          ) : entry.status === "error" ? (
            <span className="text-red-400">{icon}</span>
          ) : (
            <span className="text-gray-600">{icon}</span>
          )}
        </span>
      </div>

      {/* Detail row */}
      {entry.detail && !expanded && (
        <div className="text-[10px] text-gray-500 font-mono truncate mt-0.5 pl-4">{entry.detail}</div>
      )}

      {expanded && (
        <div className="mt-2 pl-4 space-y-1 border-t border-gray-800/60 pt-2">
          <div className="flex gap-2 text-[10px]">
            <span className="text-gray-600 uppercase tracking-wide w-12 shrink-0">Layer</span>
            <span className="text-gray-400">{LAYER_LABEL[entry.layer]}</span>
          </div>
          {entry.detail && (
            <div className="flex gap-2 text-[10px]">
              <span className="text-gray-600 uppercase tracking-wide w-12 shrink-0">Detail</span>
              <span className="text-gray-400 font-mono break-all">{entry.detail}</span>
            </div>
          )}
          {entry.duration_ms !== undefined && (
            <div className="flex gap-2 text-[10px]">
              <span className="text-gray-600 uppercase tracking-wide w-12 shrink-0">Time</span>
              <span className="text-gray-400 font-mono">{entry.duration_ms}ms</span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}
