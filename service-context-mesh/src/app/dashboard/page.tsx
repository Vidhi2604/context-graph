"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import SearchBar from "@/components/SearchBar";
import ContextGraph from "@/components/ContextGraph";
import ContextTimeline from "@/components/ContextTimeline";
import NodeDetail from "@/components/NodeDetail";
import InsightPanel from "@/components/InsightPanel";
import ValueBar from "@/components/ValueBar";
import ActivityPanel from "@/components/ActivityPanel";
import FilterBar from "@/components/FilterBar";
import OrgSwitcher from "@/components/OrgSwitcher";
import Logo from "@/components/Logo";
import { GraphNode, GraphResult, InsightResponse } from "@/types/graph";
import { PipelineTrace } from "@/lib/trace";
import { getVertical } from "@/verticals/registry";

export default function DashboardPage() {
  const router = useRouter();
  const [graph, setGraph] = useState<GraphResult | null>(null);
  const [similarSourceId, setSimilarSourceId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [stats, setStats] = useState(null);
  const [cypherInfo, setCypherInfo] = useState<{ cypher: string; confidence: number; interpretation: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [activityKey, setActivityKey] = useState(0);
  const [, setTrace] = useState<PipelineTrace | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.push("/auth/signin");
    },
  });

  const [lsOrgId, setLsOrgId] = useState("");
  const [lsVertical, setLsVertical] = useState("");
  const [lsPlan, setLsPlan] = useState("");

  useEffect(() => {
    setLsOrgId(localStorage.getItem("orgId") || "");
    setLsVertical(localStorage.getItem("vertical") || "");
    setLsPlan(localStorage.getItem("plan") || "");
  }, []);

  const orgId = lsOrgId || session?.orgId || "";
  const vertical = lsVertical || session?.vertical || "retail";
  const plan = lsPlan || session?.plan || "enterprise";

  // Redirect to onboarding if authenticated but no org yet
  useEffect(() => {
    if (status === "authenticated" && !orgId) {
      router.push("/onboarding");
    }
  }, [status, orgId, router]);

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
    setActivityKey(k => k + 1);
    setLoading(true);
    setError(null);
    setGraph(null);
    setSelectedNode(null);
    setInsight(null);
    setSimilarSourceId(null);
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
      setLastQuery(query);
      setCypherInfo({ cypher: data.cypher, confidence: data.cypher_confidence, interpretation: data.interpretation });
      if (data._trace) setTrace(data._trace);
    } catch {
      setError("Failed to search");
    } finally {
      setLoading(false);
    }
  }, [orgId, debugMode, activeFilters]);

  // Filters are client-side — derive filtered graph from full graph
  const filteredGraph = useMemo(() => {
    if (!graph) return null;
    const hasFilters = Object.values(activeFilters).some(v => v.length > 0);
    if (!hasFilters) return graph;

    const FILTER_PROP_MAP: Record<string, string> = {
      department: "department", priority: "priority", severity: "severity",
      visitType: "type", claimStatus: "status",
      tier: "tier", city: "city", category: "category", payment: "method", status: "status",
    };

    const filteredNodes = graph.nodes.filter(n => {
      // Always keep Profile and Search nodes
      if (n.label === "Profile" || n.label === "SEARCH") return true;
      for (const [filterId, values] of Object.entries(activeFilters)) {
        if (!values.length) continue;
        const prop = FILTER_PROP_MAP[filterId];
        if (!prop) continue;
        const nodeVal = String(n.properties?.[prop] || "");
        if (!values.includes(nodeVal)) return false;
      }
      return true;
    });

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = graph.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    return { ...graph, nodes: filteredNodes, edges: filteredEdges,
      summary: { ...graph.summary, total_nodes: filteredNodes.length, total_edges: filteredEdges.length } };
  }, [graph, activeFilters]);

  const handleRecenter = useCallback(async (node: GraphNode) => {
    setLoading(true);
    setSelectedNode(null);
    setError(null);
    try {
      const res = await fetch("/api/graph/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({ node_id: node.id, node_label: node.label, depth: 2 }),
      });
      if (!res.ok) throw new Error("Explore failed");
      const data = await res.json();
      if (data.nodes) setGraph(data);
    } catch {
      setError("Failed to explore node");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const handleAnalyze = useCallback(async (node?: GraphNode) => {
    const activeOrgId = localStorage.getItem("orgId") || orgId;
    if (!activeOrgId) return;
    setInsightLoading(true);
    setInsight(null);
    try {
      const url = `/api/insights${debugMode ? "?trace=true" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": activeOrgId },
        body: JSON.stringify({
          query: node ? `Analyze ${node.label}: ${node.displayName}` : lastQuery || "Analyze current graph",
          nodes: graph?.nodes?.slice(0, 20) || [],
        }),
      });
      if (!res.ok) { setError("Analysis failed — try again"); return; }
      const data = await res.json();
      // Normalise response shape — API can return flat or nested
      const insightData = data.result
        ? { context: data.context || { summary: "", data_points: [], graph_scope: "" }, reasoning: data.reasoning || [], result: data.result, confidence: data.confidence }
        : { context: null, reasoning: [], result: { finding: data.summary || data.insight || "Analysis complete", recommendation: "", confidence: data.confidence || 0.8 }, confidence: data.confidence || 0.8 };
      setInsight(insightData);
      if (data._trace) setTrace(data._trace);
    } catch {
      // silent
    } finally {
      setInsightLoading(false);
    }
  }, [orgId, graph, debugMode, lastQuery]);

  const handleFindSimilar = useCallback(async (node: GraphNode) => {
    const activeOrgId = localStorage.getItem("orgId") || orgId;
    if (!activeOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": activeOrgId },
        body: JSON.stringify({ node_id: node.id, node_label: node.label, limit: 5 }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.similar?.length > 0) {
        const toNum = (v: unknown): number => {
          if (typeof v === "number") return v;
          if (v && typeof v === "object" && "low" in v) return (v as {low:number}).low;
          return 0;
        };

        // Get name of most similar node and search for it
        const firstProps = (data.similar[0]?.node?.properties || {}) as Record<string, unknown>;
        const similarName = String(firstProps.name || firstProps.profile_id || firstProps.visit_id || "");
        const sharedCount = toNum(data.similar[0]?.shared_connections);

        if (similarName) {
          const searchRes = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-org-id": activeOrgId },
            body: JSON.stringify({ query: similarName, limit: 40 }),
          });
          const sdata = await searchRes.json();
          if (sdata.results?.nodes?.length) {
            setGraph(sdata.results);
            setLastQuery(`Similar to ${node.displayName}`);
            setSelectedNode(null);
            setSimilarSourceId(node.id);
            setError(`Found ${data.similar.length} similar profiles (${sharedCount} shared connections) · showing: ${similarName}`);
            setTimeout(() => setError(null), 4000);
          }
        }
      } else {
        setError(`No similar ${node.label} nodes found`);
        setTimeout(() => setError(null), 3000);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [orgId]);


  return (
    <div className={`min-h-screen bg-gray-950 text-white ${debugMode ? "pr-[460px]" : ""}`}>
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

        {filteredGraph && filteredGraph.nodes.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {filteredGraph.summary.total_nodes} nodes · {filteredGraph.summary.total_edges} edges
                {Object.values(activeFilters).some(v=>v.length>0) && (
                  <span className="ml-2 text-xs text-emerald-500">filtered</span>
                )}
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
                  nodes={filteredGraph.nodes}
                  edges={filteredGraph.edges}
                  query={lastQuery}
                  centerNodeId={filteredGraph.centerNodeId}
                  similarSourceId={similarSourceId}
                  onNodeClick={setSelectedNode}
                  onNodeDoubleClick={handleRecenter}
                />
              </div>
              {/* Right panel: NodeDetail when node selected, else Timeline */}
              <div className="h-[600px] bg-gray-950 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                {selectedNode ? (
                  <NodeDetail
                    node={selectedNode}
                    onClose={() => setSelectedNode(null)}
                    onAnalyze={handleAnalyze}
                    onFindSimilar={handleFindSimilar}
                  />
                ) : (
                  <div className="p-4 h-full flex flex-col overflow-hidden">
                    <ContextTimeline
                      nodes={filteredGraph.nodes}
                      query={lastQuery}
                      onEventClick={setSelectedNode}
                    />
                  </div>
                )}
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
          onRegenerate={() => { setInsight(null); setTimeout(() => handleAnalyze(), 50); }}
        />
      </main>

      {debugMode && (
        <ActivityPanel
          orgId={orgId}
          resetKey={activityKey}
          onClose={() => setDebugMode(false)}
        />
      )}
    </div>
  );
}
