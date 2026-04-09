"use client";

import { GraphNode } from "@/types/graph";

interface NodeDetailProps {
  node: GraphNode | null;
  onClose: () => void;
  onRecenter: (node: GraphNode) => void;
  onAnalyze: (node: GraphNode) => void;
  onFindSimilar: (node: GraphNode) => void;
}

export default function NodeDetail({ node, onClose, onRecenter, onAnalyze, onFindSimilar }: NodeDetailProps) {
  if (!node) return null;

  const isSuperseded = node.properties?.status === "superseded";

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-800 p-6 overflow-y-auto z-50 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: node.color }} />
          <h3 className="text-lg font-bold text-white">{node.displayName}</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
      </div>

      <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">{node.label}</div>

      {isSuperseded && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg px-3 py-2 text-xs text-yellow-400 mb-4">
          This {node.label.toLowerCase()} has been superseded
        </div>
      )}

      {/* Scores */}
      <div className="flex gap-3 mb-4">
        {node.relevance != null && (
          <div className="bg-gray-800 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-white">{Math.round(node.relevance * 100)}</div>
            <div className="text-[10px] text-gray-500">Relevance</div>
          </div>
        )}
        {node.properties.confidence_score != null && (
          <div className="bg-gray-800 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-blue-400">{Math.round(Number(node.properties.confidence_score) * 100)}%</div>
            <div className="text-[10px] text-gray-500">Confidence</div>
          </div>
        )}
      </div>

      {/* Properties */}
      <div className="space-y-3 mb-6">
        {Object.entries(node.properties)
          .filter(([k]) => !k.startsWith("_") && k !== "confidence_score")
          .map(([key, value]) => (
            <div key={key}>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{key.replace(/_/g, " ")}</p>
              <p className="text-white text-sm mt-0.5 font-mono break-all">
                {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
              </p>
            </div>
          ))}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => onRecenter(node)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Make Center Node
        </button>
        <button
          onClick={() => onAnalyze(node)}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
        >
          🧠 Analyze
        </button>
        <button
          onClick={() => onFindSimilar(node)}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Find Similar
        </button>
      </div>
    </div>
  );
}
