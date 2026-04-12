"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
import type { FilterConfig } from "@/types/vertical";

function ExportButton({ graph, insight, query, orgId }: { graph: GraphResult | null; insight: InsightResponse | null; query: string; orgId: string }) {
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState(false);
  const [naming, setNaming] = useState(false);
  const [fileName, setFileName] = useState("");

  const hasData = graph && graph.nodes.length > 0;

  const handleExportClick = () => {
    if (!hasData) { setTooltip(true); setTimeout(() => setTooltip(false), 2500); return; }
    setFileName(`contextmesh-${query.slice(0, 30).replace(/\s+/g, "-") || "export"}-${new Date().toISOString().slice(0, 10)}`);
    setNaming(true);
  };

  const doExport = async () => {
    setNaming(false);
    setLoading(true);
    try {
      if (!graph) return;
      const [JSZip, html2canvas] = await Promise.all([
        import("jszip").then(m => m.default),
        import("html2canvas").then(m => m.default),
      ]);
      const zip = new JSZip();
      const date = new Date().toISOString().slice(0, 10);
      const zipName = fileName.trim() || `contextmesh-export-${date}`;
      const folder = zip.folder(zipName)!;

      // Capture graph screenshot
      const graphEl = document.getElementById("export-graph");
      if (graphEl) {
        try {
          const canvas = await html2canvas(graphEl, { backgroundColor: "#030712", scale: 2, useCORS: true, logging: false });
          const graphBlob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), "image/png"));
          folder.file("graph.png", graphBlob);
        } catch { /* skip if capture fails */ }
      }

      // Capture timeline screenshot
      const timelineEl = document.getElementById("export-timeline");
      if (timelineEl) {
        try {
          const canvas = await html2canvas(timelineEl, { backgroundColor: "#030712", scale: 2, useCORS: true, logging: false });
          const timelineBlob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), "image/png"));
          folder.file("timeline.png", timelineBlob);
        } catch { /* skip if capture fails */ }
      };

      // Auto-run analysis if not already done
      let exportInsight = insight;
      if (!exportInsight && graph.nodes.length > 0) {
        try {
          const insightRes = await fetch("/api/insights", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-org-id": orgId },
            body: JSON.stringify({ query: query || "Analyze current graph", nodes: graph.nodes.slice(0, 20) }),
          });
          if (insightRes.ok) {
            const insightData = await insightRes.json();
            exportInsight = insightData.result
              ? insightData
              : { context: null, reasoning: [], result: { finding: insightData.summary || insightData.insight || "", recommendation: insightData.recommendation || "" }, confidence: insightData.confidence || 0.8 };
          }
        } catch { /* use null */ }
      }

      // analysis.txt
      if (exportInsight) {
        const insight = exportInsight;
        let analysisText = `CONTEXTMESH ANALYSIS\n${"=".repeat(50)}\nQuery: ${query}\nDate: ${date}\n\n`;
        if (insight.result?.finding) analysisText += `FINDING\n${"-".repeat(30)}\n${insight.result.finding}\n\n`;
        if (insight.result?.recommendation) analysisText += `RECOMMENDATION\n${"-".repeat(30)}\n${insight.result.recommendation}\n\n`;
        if (insight.result?.impact) analysisText += `IMPACT\n${"-".repeat(30)}\n${insight.result.impact}\n\n`;
        if (insight.context) {
          const ctx = insight.context;
          analysisText += `CONTEXT\n${"-".repeat(30)}\n`;
          if (ctx.summary) analysisText += `${ctx.summary}\n`;
          if (ctx.graph_scope) analysisText += `Scope: ${ctx.graph_scope}\n`;
          if (ctx.data_points?.length) ctx.data_points.forEach(d => { analysisText += `• ${d}\n`; });
          analysisText += "\n";
        }
        if (insight.reasoning?.length) {
          analysisText += `REASONING CHAIN\n${"-".repeat(30)}\n`;
          insight.reasoning.forEach((r, i) => {
            analysisText += `${i + 1}. ${r.observation || ""}`;
            if (r.implication) analysisText += ` → ${r.implication}`;
            analysisText += "\n";
          });
          analysisText += "\n";
        }
        folder.file("analysis.txt", analysisText);

        // quick_actions.txt
        let actionsText = `QUICK ACTIONS\n${"=".repeat(50)}\nQuery: ${query}\nDate: ${date}\n\n`;
        if (insight.result?.recommendation) {
          actionsText += `Based on the analysis:\n\n`;
          const rec = insight.result.recommendation;
          const sentences = rec.split(/[.!?]+/).filter(s => s.trim().length > 10);
          sentences.forEach((s, i) => { actionsText += `${i + 1}. ${s.trim()}\n`; });
        } else {
          actionsText += `• Run a search and use the Analyze button to generate action items.\n`;
        }
        // quick_actions — also use insight from above
        if (!insight.result?.recommendation) {
          actionsText += `• Review the finding above and take appropriate action.\n`;
          actionsText += `• Consider running a more specific search to refine the analysis.\n`;
        }
        folder.file("quick_actions.txt", actionsText);
      } else {
        folder.file("analysis.txt", `Analysis could not be generated for this export.\nThis may happen if the AI service is unavailable. Try using the Analyze button on the dashboard and export again.\n`);
        folder.file("quick_actions.txt", `Quick actions could not be generated for this export.\nTry using the Analyze button on the dashboard and export again.\n`);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${zipName}.zip`; a.click();
      URL.revokeObjectURL(url);
    } finally { setLoading(false); }
  };

  return (
    <div className="relative">
      <button onClick={handleExportClick} disabled={loading}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
          hasData ? "border-gray-700 text-gray-400 hover:text-white hover:border-gray-600" : "border-gray-800 text-gray-600 cursor-not-allowed"
        }`}>
        {loading ? "Exporting..." : "⬇ Export"}
      </button>
      {tooltip && (
        <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 whitespace-nowrap z-50">
          Search and filter data first
        </div>
      )}
      {naming && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-96 space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold">Name your export</h3>
            <input
              type="text"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") doExport(); if (e.key === "Escape") setNaming(false); }}
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-gray-500">The ZIP will contain graph, timeline, analysis, and quick actions.</p>
            <div className="flex gap-2">
              <button onClick={doExport} disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                {loading ? "Exporting..." : "Export"}
              </button>
              <button onClick={() => setNaming(false)} className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:bg-gray-800 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [graph, setGraph] = useState<GraphResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [stats, setStats] = useState<{ events_tracked: number; profiles_resolved: number; identity_fragments: number; commitments: Record<string, number>; avg_extraction_confidence: number } | null>(null);
  const [cypherInfo, setCypherInfo] = useState<{ cypher: string; confidence: number; interpretation: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [activityKey, setActivityKey] = useState(0);
  const [, setTrace] = useState<PipelineTrace | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [dynamicFilters, setDynamicFilters] = useState<FilterConfig[]>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
    if (status === "authenticated" && !session?.orgId && !lsOrgId) {
      router.push("/onboarding");
    }
  }, [status, session?.orgId, lsOrgId, router]);

  // Safe vertical config — fallback to retail if unknown vertical value
  const verticalConfig = (() => {
    try { return getVertical(vertical); } catch { return getVertical("retail"); }
  })();

  // Auto-trigger search from URL param (e.g. coming from Events page)
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && orgId) handleSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

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

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const refreshStats = useCallback(() => {
    if (!orgId) return;
    fetch("/api/stats", { headers: { "x-org-id": orgId } })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    refreshStats();
    fetch("/api/schema/filters", { headers: { "x-org-id": orgId } })
      .then((r) => r.json())
      .then((data) => { if (data.filters) setDynamicFilters(data.filters); })
      .catch(() => {});
    // Refresh stats every 30s
    const interval = setInterval(refreshStats, 30000);
    return () => clearInterval(interval);
  }, [orgId, refreshStats]);

  const handleSearch = useCallback(async (query: string) => {
    setActivityKey(k => k + 1);
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
        body: JSON.stringify({ query, limit: 50, filters: activeFilters }),
      });
      const data = await res.json();

      if (!res.ok) { setError(data.error || "Search failed"); return; }

      setGraph(data.results);
      setLastQuery(query);
      refreshStats();
      setCypherInfo({ cypher: data.cypher, confidence: data.cypher_confidence, interpretation: data.interpretation });
      if (data._trace) setTrace(data._trace);
    } catch {
      setError("Failed to search");
    } finally {
      setLoading(false);
    }
  }, [orgId, debugMode, activeFilters]);

  // Filtering is server-side — graph already contains only matching profiles + their full context
  const filteredGraph = useMemo(() => graph, [graph]);

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



  return (
    <div className={`min-h-screen bg-gray-950 text-white ${debugMode ? "pr-[460px]" : ""}`}>
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Logo size={36} showText />
            </Link>
            <OrgSwitcher currentOrgId={orgId} currentVertical={vertical} />
            <span className="text-xs font-semibold bg-emerald-900/30 text-emerald-400 px-2.5 py-1 rounded capitalize">
              {plan}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Nav */}
            <nav className="flex gap-1">
              <Link href="/dashboard/analytics" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors">Analytics</Link>
              <Link href="/dashboard/policies" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors">Drift Analysis</Link>
              <Link href="/dashboard/agents" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors">Agents</Link>
              <Link href="/dashboard/commitments" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors">Commitments</Link>
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

            {/* Export button */}
            <ExportButton graph={filteredGraph} insight={insight} query={lastQuery} orgId={orgId} />

            {/* User menu */}
            <div ref={userMenuRef} className="relative border-l border-gray-800 pl-3">
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 focus:outline-none hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-sm font-bold text-white">
                  {session?.user?.name?.[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || "U"}
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-gray-800">
                    <div className="text-sm font-medium text-white truncate">
                      {session?.user?.name || session?.user?.email?.split("@")[0] || "Demo User"}
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{session?.user?.email}</div>
                    <div className="mt-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium capitalize ${
                        lsPlan === "enterprise" ? "bg-purple-900/40 text-purple-300" :
                        lsPlan === "pro" ? "bg-blue-900/40 text-blue-300" :
                        "bg-gray-800 text-gray-400"
                      }`}>
                        {lsPlan || "starter"} plan
                      </span>
                    </div>
                  </div>

                  {/* Nav items */}
                  <div className="py-1">
                    <Link
                      href="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                    >
                      <span>⚙️</span> Settings
                    </Link>
                    <Link
                      href="/api-docs"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                    >
                      <span>📄</span> API Docs
                    </Link>
                  </div>

                  <div className="border-t border-gray-800 py-1">
                    <button
                      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                    >
                      <span>↪</span> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-4 space-y-4">
        <ValueBar stats={stats} />

        <SearchBar
          onSearch={handleSearch}
          loading={loading}
          cypherInfo={cypherInfo}
          orgId={orgId}
        />

        <FilterBar
          filters={dynamicFilters.length > 0 ? dynamicFilters : verticalConfig.filters}
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
              <div className="col-span-2" id="export-graph">
                <ContextGraph
                  nodes={filteredGraph.nodes}
                  edges={filteredGraph.edges}
                  query={lastQuery}
                  centerNodeId={filteredGraph.centerNodeId}
                  onNodeClick={setSelectedNode}
                  onNodeDoubleClick={handleRecenter}
                />
              </div>
              {/* Right panel: NodeDetail when node selected, else Timeline */}
              <div id="export-timeline" className="h-[600px] bg-gray-950 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                {selectedNode ? (
                  <NodeDetail
                    node={selectedNode}
                    onClose={() => setSelectedNode(null)}
                    onAnalyze={handleAnalyze}
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
          stats?.events_tracked === 0 || !stats ? (
            <div className="text-center py-24 space-y-4">
              <div className="text-5xl">📂</div>
              <h2 className="text-xl font-semibold">No data yet</h2>
              <p className="text-gray-500 max-w-sm mx-auto text-sm">
                Import your first dataset to start building context graphs and timelines.
              </p>
              <div className="flex gap-3 justify-center mt-2">
                <Link href="/import"
                  className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                  Import Data
                </Link>
                <Link href="/settings"
                  className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                  Connect a Source
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-24">
              <div className="text-4xl mb-4">🔍</div>
              <h2 className="text-xl font-semibold mb-2">Search to Explore</h2>
              <p className="text-gray-500 max-w-md mx-auto">
                Type any question about your data — customer names, events, products, or combine them all.
              </p>
            </div>
          )
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

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageInner />
    </Suspense>
  );
}
