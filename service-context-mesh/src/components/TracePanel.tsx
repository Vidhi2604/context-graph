"use client";

import { useState } from "react";
import { PipelineTrace, TraceStep, LAYER_COLORS, LAYER_LABELS } from "@/lib/trace";

interface TracePanelProps {
  trace: PipelineTrace | null;
  onClose: () => void;
}

export default function TracePanel({ trace, onClose }: TracePanelProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  if (!trace) {
    return (
      <div className="fixed right-0 top-0 h-full w-[420px] bg-gray-900 border-l border-gray-800 flex flex-col z-40">
        <Header onClose={onClose} trace={null} />
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          Run a search to see the pipeline trace
        </div>
      </div>
    );
  }

  const totalMs = trace.total_ms;

  return (
    <div className="fixed right-0 top-0 h-full w-[420px] bg-gray-900 border-l border-gray-800 flex flex-col z-40">
      <Header onClose={onClose} trace={trace} />

      {/* Duration bar */}
      <div className="px-4 py-2 border-b border-gray-800">
        <div className="flex h-3 rounded-full overflow-hidden gap-px">
          {trace.steps.map((step) => (
            <div
              key={step.step_number}
              className="h-full transition-all"
              style={{
                width: `${Math.max((step.duration_ms / totalMs) * 100, 1)}%`,
                backgroundColor: LAYER_COLORS[step.layer],
                opacity: step.status === "skipped" ? 0.3 : 1,
              }}
              title={`${step.name}: ${step.duration_ms}ms`}
            />
          ))}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {Array.from(new Set(trace.steps.map((s) => s.layer))).map((layer) => (
            <span key={layer} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LAYER_COLORS[layer] }} />
              {LAYER_LABELS[layer]}
            </span>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {trace.steps.map((step) => (
          <StepCard
            key={step.step_number}
            step={step}
            totalMs={totalMs}
            expanded={expandedStep === step.step_number}
            onToggle={() =>
              setExpandedStep(expandedStep === step.step_number ? null : step.step_number)
            }
          />
        ))}
      </div>
    </div>
  );
}

function Header({ onClose, trace }: { onClose: () => void; trace: PipelineTrace | null }) {
  return (
    <div className="px-4 py-3 border-b border-gray-800 flex items-start justify-between shrink-0">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Pipeline Trace</span>
          {trace && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              trace.status === "success" ? "bg-emerald-900/40 text-emerald-400" :
              trace.status === "error" ? "bg-red-900/40 text-red-400" :
              "bg-yellow-900/40 text-yellow-400"
            }`}>
              {trace.status}
            </span>
          )}
        </div>
        {trace && (
          <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[300px]">
            {trace.trigger} · {trace.total_ms}ms · {trace.steps.length} steps
          </p>
        )}
      </div>
      <button onClick={onClose} className="text-gray-500 hover:text-white mt-0.5">&times;</button>
    </div>
  );
}

function StepCard({
  step, totalMs, expanded, onToggle,
}: {
  step: TraceStep; totalMs: number; expanded: boolean; onToggle: () => void;
}) {
  const durationColor =
    step.duration_ms < 100 ? "text-emerald-400" :
    step.duration_ms < 500 ? "text-yellow-400" : "text-red-400";

  const statusIcon =
    step.status === "success" ? "✅" :
    step.status === "skipped" ? "⏭" : "❌";

  return (
    <div
      className={`rounded-lg border transition-colors ${
        expanded ? "border-gray-600 bg-gray-800/60" : "border-gray-800 bg-gray-900 hover:bg-gray-800/40"
      } ${step.status === "error" ? "border-red-800/50" : ""}`}
    >
      <button
        className="w-full text-left px-3 py-2.5 flex items-center gap-2"
        onClick={onToggle}
      >
        {/* Step number */}
        <span className="text-[10px] text-gray-600 font-mono w-4 shrink-0">
          {step.step_number}
        </span>

        {/* Layer color dot */}
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: LAYER_COLORS[step.layer], opacity: step.status === "skipped" ? 0.4 : 1 }}
        />

        {/* Name + fn */}
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium truncate ${step.status === "skipped" ? "text-gray-600" : "text-white"}`}>
            {step.name}
          </div>
          <div className="text-[10px] text-gray-600 font-mono truncate">{step.fn}</div>
        </div>

        {/* Duration + status */}
        <div className="text-right shrink-0">
          {step.status !== "skipped" ? (
            <span className={`text-[10px] font-mono ${durationColor}`}>
              {step.duration_ms}ms
            </span>
          ) : (
            <span className="text-[10px] text-gray-700">—</span>
          )}
          <div className="text-[10px]">{statusIcon}</div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-800/60 pt-2">
          {step.input_summary && (
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Input</p>
              <p className="text-[10px] text-gray-400 font-mono break-all">{step.input_summary}</p>
            </div>
          )}
          {step.output_summary && (
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Output</p>
              <p className="text-[10px] text-gray-400 font-mono break-all">{step.output_summary}</p>
            </div>
          )}
          {step.error && (
            <div>
              <p className="text-[10px] text-red-600 uppercase tracking-wide mb-0.5">Error</p>
              <p className="text-[10px] text-red-400 font-mono break-all">{step.error}</p>
            </div>
          )}
          {/* Duration proportion */}
          {step.status !== "skipped" && (
            <div>
              <div className="flex justify-between text-[10px] text-gray-700 mb-1">
                <span>{LAYER_LABELS[step.layer]} layer</span>
                <span>{((step.duration_ms / totalMs) * 100).toFixed(1)}% of total</span>
              </div>
              <div className="h-1 bg-gray-800 rounded-full">
                <div
                  className="h-1 rounded-full"
                  style={{
                    width: `${Math.min((step.duration_ms / totalMs) * 100, 100)}%`,
                    backgroundColor: LAYER_COLORS[step.layer],
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
