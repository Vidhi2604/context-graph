"use client";

import { InsightResponse } from "@/types/graph";

interface InsightPanelProps {
  insight: InsightResponse | null;
  loading: boolean;
  planLevel: "none" | "summary" | "full";
  onRegenerate: () => void;
}

export default function InsightPanel({ insight, loading, planLevel, onRegenerate }: InsightPanelProps) {
  if (planLevel === "none") return null;
  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-1/3 mb-4" />
        <div className="h-3 bg-gray-800 rounded w-full mb-2" />
        <div className="h-3 bg-gray-800 rounded w-2/3" />
      </div>
    );
  }
  if (!insight) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">AI Insight</h3>
        <button onClick={onRegenerate} className="text-xs text-gray-500 hover:text-gray-300">
          Regenerate
        </button>
      </div>

      {planLevel === "full" && insight.context ? (
        // Enterprise: full reasoning chain
        <div className="grid grid-cols-3 gap-4 h-[380px]">
          {/* Context */}
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col min-h-0">
            <h4 className="text-xs font-semibold text-emerald-400 uppercase mb-3 shrink-0">Context</h4>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              <p className="text-xs text-gray-300">{insight.context.summary}</p>
              <ul className="space-y-1">
                {insight.context.data_points.map((dp, i) => (
                  <li key={i} className="text-[10px] text-gray-500">• {dp}</li>
                ))}
              </ul>
              <p className="text-[10px] text-gray-600">{insight.context.graph_scope}</p>
            </div>
          </div>

          {/* Reasoning */}
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col min-h-0">
            <h4 className="text-xs font-semibold text-blue-400 uppercase mb-3 shrink-0">Reasoning</h4>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {insight.reasoning.map((step) => (
                <div key={step.step} className="bg-gray-950 rounded-lg p-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600">Step {step.step}</span>
                    <span className="text-[10px] text-blue-400 font-mono">
                      {Math.round(step.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-300 mt-1">{step.observation}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">→ {step.implication}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col min-h-0">
            <h4 className="text-xs font-semibold text-purple-400 uppercase mb-3 shrink-0">Result</h4>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              <p className="text-xs text-white font-medium">{insight.result.finding}</p>
              <p className="text-xs text-gray-300">{insight.result.recommendation}</p>
              <span className="text-[10px] text-gray-500">
                Confidence: {Math.round(insight.result.confidence * 100)}%
              </span>
              {insight.result.impact && (
                <p className="text-[10px] text-emerald-400">{insight.result.impact}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Pro: summary only
        <div className="space-y-3">
          <p className="text-sm text-white">{insight.result?.finding || "No finding available"}</p>
          <p className="text-sm text-gray-300">{insight.result?.recommendation || ""}</p>
          <p className="text-xs text-gray-500">
            Confidence: {Math.round((insight.result?.confidence ?? 0) * 100)}%
          </p>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mt-3">
            <p className="text-xs text-gray-400">
              🔒 Upgrade to Enterprise for full reasoning chain — see step-by-step logic behind every insight
            </p>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-600 mt-4">
        AI-generated. Verify before taking action.
      </p>
    </div>
  );
}
