"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SearchBar from "@/components/SearchBar";
import ContextGraph from "@/components/ContextGraph";
import EventTimeline from "@/components/EventTimeline";
import NodeDetail from "@/components/NodeDetail";
import InsightPanel from "@/components/InsightPanel";
import ValueBar from "@/components/ValueBar";
import TracePanel from "@/components/TracePanel";
import { GraphNode, GraphResult, InsightResponse } from "@/types/graph";
import { PipelineTrace } from "@/lib/trace";

export default function DashboardPage() {
  const [graph, setGraph] = useState<GraphResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [stats, setStats] = useState(null);
  const [cypherInfo, setCypherInfo] = useState<{ cypher: string; confidence: number; interpretation: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [trace, setTrace] = useState<PipelineTrace | null>(null);

  const { data: session } = useSession();

  // Prefer session data, fall back to localStorage (for demo without auth)
  const orgId = session?.orgId || (typeof window !== "undefined" ? localStorage.getItem("orgId") || "" : "");
  const vertical = session?.vertical || (typeof window !== "undefined" ? localStorage.getItem("vertical") || "retail" : "retail");
  const plan = session?.plan || (typeof window !== "undefined" ? localStorage.getItem("plan") || "enterprise" : "enterprise");

  const sampleQueries = vertical === "retail"
    ? ["Gold tier returns in Bangalore", "COD orders above 5000", "Nike return rate"]
    : ["readmissions within 30 days", "Dr. Sharma cardiac patients", "insurance denials"];

  useEffect(() => {
    if (!orgId) return;
    fetch("/api/stats", { headers: { "x-org-id": orgId } })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [orgId]);

  const handleSearch = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    setGraph(null);
    setSelectedNode(null);
    setInsight(null);
    setCypherInfo(null);
    setTrace(null);

    try {
      const url = `/api/search${debugMode ? "?trace=true" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({ query, limit: 50 }),
      });
      const data = await res.json();

      if (!res.ok) { setError(data.error || "Search failed"); return; }

      setGraph(data.results);
      setCypherInfo({ cypher: data.cypher, confidence: data.cypher_confidence, interpretation: data.interpretation });
      if (data._trace) setTrace(data._trace);
    } catch {
      setError("Failed to search");
    } finally {
      setLoading(false);
    }
  }, [orgId, debugMode]);

  const handleRecenter = useCallback(async (node: GraphNode) => {
    setLoading(true);
    setSelectedNode(null);
    try {
      const res = await fetch("/api/graph/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({ node_id: node.id, node_label: node.label, depth: 2 }),
      });
      const data = await res.json();
      setGraph(data);
    } catch {
      setError("Failed to explore node");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const handleAnalyze = useCallback(async (node?: GraphNode) => {
    setInsightLoading(true);
    try {
      const url = `/api/insights${debugMode ? "?trace=true" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({
          query: node ? `Analyze ${node.label}: ${node.displayName}` : "Analyze current graph",
          nodes: graph?.nodes || [],
        }),
      });
      const data = await res.json();
      const insightData = data.result
        ? { context: data.context || { summary: "", data_points: [], graph_scope: "" }, reasoning: data.reasoning || [], result: data.result }
        : data;
      setInsight(insightData);
      if (data._trace) setTrace(data._trace);
    } catch {
      // silent
    } finally {
      setInsightLoading(false);
    }
  }, [orgId, graph, debugMode]);

  const handleFindSimilar = useCallback(async (node: GraphNode) => {
    setLoading(true);
    try {
      await fetch("/api/search/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({ node_id: node.id, node_label: node.label, limit: 5 }),
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const isRetail = vertical === "retail";

  return (
    <div className={`min-h-screen bg-gray-950 text-white ${debugMode ? "pr-[420px]" : ""}`}>
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">
              <span className="text-emerald-400">Context</span>Mesh
            </h1>
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
              {isRetail ? "🏪 Retail" : "🏥 Healthcare"}
            </span>
            <span className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded capitalize">
              {plan}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Side B nav */}
            <nav className="flex gap-1 text-xs">
              <Link href="/dashboard/analytics" className="px-2 py-1 text-gray-500 hover:text-white transition-colors">Analytics</Link>
              <Link href="/dashboard/policies" className="px-2 py-1 text-gray-500 hover:text-white transition-colors">Policies</Link>
              <Link href="/dashboard/agents" className="px-2 py-1 text-gray-500 hover:text-white transition-colors">Agents</Link>
              <Link href="/dashboard/commitments" className="px-2 py-1 text-gray-500 hover:text-white transition-colors">Commitments</Link>
            </nav>
            {/* Debug toggle */}
            <button
              onClick={() => { setDebugMode(!debugMode); if (!debugMode) setTrace(null); }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                debugMode
                  ? "bg-purple-900/30 border-purple-700 text-purple-300"
                  : "border-gray-700 text-gray-500 hover:text-white hover:border-gray-600"
              }`}
            >
              🔬 Debug
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-4 space-y-4">
        <ValueBar stats={stats} />

        <SearchBar
          onSearch={handleSearch}
          loading={loading}
          sampleQueries={sampleQueries}
          cypherInfo={cypherInfo}
        />

        {error && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {graph && graph.nodes.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {graph.summary.total_nodes} nodes · {graph.summary.total_edges} edges
              </span>
              <button
                onClick={() => handleAnalyze()}
                className="bg-gray-800 hover:bg-gray-700 text-sm px-4 py-1.5 rounded-lg transition-colors"
              >
                🧠 Analyze
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <ContextGraph
                  nodes={graph.nodes}
                  edges={graph.edges}
                  centerNodeId={graph.centerNodeId}
                  onNodeClick={setSelectedNode}
                  onNodeDoubleClick={handleRecenter}
                />
              </div>
              <div>
                <EventTimeline
                  timeline={graph.timeline}
                  onEventClick={setSelectedNode}
                />
              </div>
            </div>
          </>
        )}

        {!graph && !loading && !error && (
          <div className="text-center py-24">
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold mb-2">Search to Explore</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Type any question about your data — customer names, conditions, products, providers, or combine them all.
            </p>
          </div>
        )}

        <InsightPanel
          insight={insight}
          loading={insightLoading}
          planLevel={plan === "enterprise" ? "full" : plan === "pro" ? "summary" : "none"}
          onRegenerate={() => handleAnalyze()}
        />
      </main>

      <NodeDetail
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onRecenter={handleRecenter}
        onAnalyze={handleAnalyze}
        onFindSimilar={handleFindSimilar}
      />

      {/* Trace panel — slides in from right when debug mode on */}
      {debugMode && (
        <TracePanel
          trace={trace}
          onClose={() => { setDebugMode(false); setTrace(null); }}
        />
      )}
    </div>
  );
}
