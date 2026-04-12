"use client";

import { useState, useEffect } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading: boolean;
  cypherInfo?: { cypher: string; confidence: number; interpretation: string } | null;
  orgId?: string;
}

export default function SearchBar({ onSearch, loading, cypherInfo, orgId }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [showCypher, setShowCypher] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!orgId) return;
    fetch("/api/search/suggestions", { headers: { "x-org-id": orgId } })
      .then(r => r.json())
      .then(d => { if (d.suggestions?.length) setSuggestions(d.suggestions); })
      .catch(() => {});
  }, [orgId]);

  const handleSubmit = () => {
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Search anything..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-6 py-3 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Dynamic suggestions */}
      {suggestions.length > 0 && !query && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { setQuery(s); onSearch(s); }}
              className="text-xs px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-full text-gray-400 hover:border-emerald-600 hover:text-emerald-400 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Cypher info */}
      {cypherInfo && (
        <div className="text-xs text-gray-600">
          <button
            onClick={() => setShowCypher(!showCypher)}
            className="hover:text-gray-400 transition-colors"
          >
            {cypherInfo.interpretation} · confidence: {Math.round(cypherInfo.confidence * 100)}% · {showCypher ? "hide" : "show"} query
          </button>
          {showCypher && (
            <pre className="mt-1 bg-gray-950 border border-gray-800 rounded p-2 overflow-x-auto text-green-400">
              {cypherInfo.cypher}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
