"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import SearchBar from "@/components/SearchBar";
import ContextGraph from "@/components/ContextGraph";
import ContextTimeline from "@/components/ContextTimeline";
import NodeDetail from "@/components/NodeDetail";
import InsightPanel from "@/components/InsightPanel";
import ValueBar from "@/components/ValueBar";
import TracePanel from "@/components/TracePanel";
import FilterBar from "@/components/FilterBar";
import OrgSwitcher from "@/components/OrgSwitcher";
import Logo from "@/components/Logo";
import { GraphNode, GraphResult, InsightResponse } from "@/types/graph";
import { PipelineTrace } from "@/lib/trace";
import { getVertical } from "@/verticals/registry";

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
  const [lastQuery, setLastQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});

  const { data: session } = useSession();

  // localStorage always takes priority (user may have switched org manually)
  // Session is only used if localStorage is empty
  const lsOrgId = typeof window !== "undefined" ? localStorage.getItem("orgId") || "" : "";
  const lsVertical = typeof window !== "undefined" ? localStorage.getItem("vertical") || "" : "";
  const lsPlan = typeof window !== "undefined" ? localStorage.getItem("plan") || "" : "";

  const orgId = lsOrgId || session?.orgId || "";
  const vertical = lsVertical || session?.vertical || "retail";
  const plan = lsPlan || session?.plan || "enterprise";

  // Safe vertical config — fallback to retail if unknown vertical value
  const verticalConfig = (() => {
    try { return getVertical(vertical); } catch { return getVertical("retail"); }
  })();
  const sampleQueries = verticalConfig.sampleQueries.slice(0, 3);

  const handleFilterChange = useCallback((filterId: string, values: string[]) => {
    setActiveFilters((prev) => ({ ...prev, [filterId]: values }));
  }, []);

  const handleFilterClear = useCallback(() => setActiveFilters({}), []);

  // Sync session → localStorage on first load (when localStorage is empty)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("orgId") && session?.orgId) {
      localStorage.setItem("orgId", session.orgId);
      localStorage.setItem("vertical", session.vertical || "retail");
      localStorage.setItem("plan", session.plan || "enterprise");
    }
  }, [session]);

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

    // Append active filters to query as natural language context
    const filterParts = Object.entries(activeFilters)
      .filter(([, v]) => v.length > 0)
      .map(([k, v]) => {
        if (k === "dateRange") return `last ${v[0]}`;
        return `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${v.join(" or ")}`;
      });
    const enrichedQuery = filterParts.length > 0
      ? `${query} (${filterParts.join(", ")})`
      : query;

    try {
      const url = `/api/search${debugMode ? "?trace=true" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({ query: enrichedQuery, limit: 50, filters: activeFilters }),
      });
      const data = await res.json();

      if (!res.ok) { setError(data.error || "Search failed"); return; }

      setGraph(data.results);
      setLastQuery(enrichedQuery);
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


  return (
    <div className={`min-h-screen bg-gray-950 text-white ${debugMode ? "pr-[420px]" : ""}`}>
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Logo size={28} showText />
            </Link>
            <OrgSwitcher currentOrgId={orgId} currentVertical={vertical} />
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
              <Link href="/settings" className="px-2 py-1 text-gray-500 hover:text-white transition-colors">Settings</Link>
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

            {/* User indicator */}
            <div className="flex items-center gap-2 border-l border-gray-800 pl-3">
              <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center text-xs font-bold text-white">
                {session?.user?.name?.[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="text-xs">
                <div className="text-gray-300 max-w-[100px] truncate">
                  {session?.user?.name || session?.user?.email?.split("@")[0] || "Demo User"}
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                className="text-xs text-gray-600 hover:text-red-400 transition-colors ml-1"
                title="Sign out"
              >
                ↪
              </button>
            </div>
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

        <FilterBar
          filters={verticalConfig.filters}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClear={handleFilterClear}
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
                  query={lastQuery}
                  centerNodeId={graph.centerNodeId}
                  onNodeClick={setSelectedNode}
                  onNodeDoubleClick={handleRecenter}
                />
              </div>
              <div>
                <ContextTimeline
                  nodes={graph.nodes}
                  query={lastQuery}
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
