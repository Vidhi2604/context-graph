"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
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
  onWidthChange?: (width: number) => void;
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


export default function ActivityPanel({ orgId, resetKey, onClose, onWidthChange }: Props) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [width, setWidth] = useState(460);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const sinceRef = useRef<number>(0);

  const onDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    e.preventDefault();
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const newWidth = Math.max(320, Math.min(900, startWidth.current + delta));
      setWidth(newWidth);
      onWidthChange?.(newWidth);
    };
    const onMouseUp = () => { isDragging.current = false; };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

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
    <div className="fixed right-0 top-0 h-full bg-gray-900 border-l border-gray-800 flex flex-col z-40" style={{ width }}>
      {/* Resize handle */}
      <div
        onMouseDown={onDragStart}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/40 transition-colors z-50"
      />
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Activity Log</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 animate-pulse">
              live
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Real-time pipeline trace — see exactly what happens on every search or ingest</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEntries([]); sinceRef.current = 0; }}
            className="text-xs text-gray-600 hover:text-gray-400"
          >
            clear
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-white">&times;</button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-gray-800 shrink-0">
        <p className="text-xs text-gray-600 mb-1.5">Color indicates pipeline layer:</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(Object.keys(LAYER_COLOR) as ActivityLayer[]).map(layer => (
            <span key={layer} className="flex items-center gap-1 text-xs text-gray-500" title={`${LAYER_LABEL[layer]} layer`}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: LAYER_COLOR[layer] }} />
              {LAYER_LABEL[layer]}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-4">
        {pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm gap-2">
            <span className="text-2xl">⬡</span>
            <span>Waiting for activity…</span>
            <span className="text-xs">Run a search or trigger an ingest</span>
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
  const time = new Date(pipeline.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="space-y-0.5">
      {/* Timestamp */}
      <div className="text-xs text-gray-600 font-mono mb-1">{time}</div>

      {/* Always single column, scrollable */}
      <div className="space-y-0.5">
        {pipeline.entries.map(entry => <EntryCard key={entry.id} entry={entry} />)}
      </div>
    </div>
  );
}

// Keys that get a full-width code block treatment
const CODE_KEYS = new Set(["cypher", "error"]);

function MetadataBlock({ metadata }: { metadata: Record<string, unknown> }) {
  const codeEntries = Object.entries(metadata).filter(([k]) => CODE_KEYS.has(k));
  const scalarEntries = Object.entries(metadata).filter(([k, v]) => !CODE_KEYS.has(k) && !Array.isArray(v));
  const arrayEntries = Object.entries(metadata).filter(([, v]) => Array.isArray(v));

  return (
    <div className="space-y-1.5 border-t border-gray-800/40 pt-1.5">
      {/* Scalar key-value pairs in a grid */}
      {scalarEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {scalarEntries.map(([k, v]) => (
            <div key={k} className="flex gap-1.5 items-baseline min-w-0">
              <span className="text-[11px] text-gray-600 uppercase tracking-wide shrink-0">{k.replace(/_/g, " ")}</span>
              <span className={`text-xs font-mono truncate ${
                k === "confidence" ? (Number(v) >= 0.8 ? "text-emerald-400" : Number(v) >= 0.5 ? "text-yellow-400" : "text-red-400")
                : k === "fallback" ? "text-orange-400"
                : "text-gray-300"
              }`}>
                {typeof v === "boolean" ? (v ? "yes" : "no") : String(v ?? "—")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Array values as pill lists */}
      {arrayEntries.map(([k, v]) => (
        <div key={k} className="flex items-start gap-1.5">
          <span className="text-[11px] text-gray-600 uppercase tracking-wide shrink-0 mt-0.5">{k.replace(/_/g, " ")}</span>
          <div className="flex flex-wrap gap-1">
            {(v as unknown[]).map((item, i) => (
              <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">{String(item)}</span>
            ))}
          </div>
        </div>
      ))}

      {/* Code blocks (cypher, error) */}
      {codeEntries.map(([k, v]) => (
        <div key={k}>
          <span className="text-[11px] text-gray-600 uppercase tracking-wide">{k}</span>
          <pre className={`mt-0.5 text-xs font-mono whitespace-pre-wrap break-all rounded p-2 leading-relaxed ${
            k === "error" ? "bg-red-950/40 text-red-300" : "bg-gray-800/60 text-cyan-300"
          }`}>{String(v)}</pre>
        </div>
      ))}
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
        <span className={`text-xs font-mono shrink-0 ${
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

        <span className="text-xs shrink-0">
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
        <div className="text-xs text-gray-500 font-mono truncate mt-0.5 pl-4">{entry.detail}</div>
      )}

      {expanded && (
        <div className="mt-2 pl-4 space-y-1.5 border-t border-gray-800/60 pt-2">
          <div className="flex gap-2 text-xs">
            <span className="text-gray-600 uppercase tracking-wide w-14 shrink-0">Layer</span>
            <span className="text-gray-400">{LAYER_LABEL[entry.layer]}</span>
          </div>
          {entry.detail && (
            <div className="flex gap-2 text-xs">
              <span className="text-gray-600 uppercase tracking-wide w-14 shrink-0">Detail</span>
              <span className="text-gray-400 font-mono break-all">{entry.detail}</span>
            </div>
          )}
          {entry.duration_ms !== undefined && (
            <div className="flex gap-2 text-xs">
              <span className="text-gray-600 uppercase tracking-wide w-14 shrink-0">Time</span>
              <span className="text-gray-400 font-mono">{entry.duration_ms}ms</span>
            </div>
          )}
          {entry.metadata && <MetadataBlock metadata={entry.metadata} />}
        </div>
      )}
    </button>
  );
}
