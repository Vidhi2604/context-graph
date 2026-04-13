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
import CSVUpload from "@/components/CSVUpload";
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
        className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        style={{ background:"var(--bg-surface-2)", color: hasData ? "var(--text-primary)" : "var(--text-muted)", border:"1px solid var(--border)", cursor: hasData ? "pointer" : "not-allowed" }}>
        {loading ? "Exporting..." : "⬆ Export"}
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
  const [loadingStep, setLoadingStep] = useState(0);
  const LOADING_STEPS = [
    "Translating to graph query...",
    "Traversing knowledge graph...",
    "Resolving identities...",
    "Building timeline...",
    "Mapping relationships...",
    "Almost there...",
  ];

  useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    setLoadingStep(0);
    const interval = setInterval(() => setLoadingStep(s => (s + 1) % 6), 1400);
    return () => clearInterval(interval);
  }, [loading]);
  const [dynamicFilters, setDynamicFilters] = useState<FilterConfig[]>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activityPanelWidth, setActivityPanelWidth] = useState(460);
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
    if (session?.apiKey) {
      localStorage.setItem("apiKey", session.apiKey);
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
      .then((d) => { if (d.events_tracked !== undefined) setStats(d); else setStats({ events_tracked: 0, profiles_resolved: 0, identity_fragments: 0, commitments: {}, avg_extraction_confidence: 0 }); })
      .catch(() => { setStats({ events_tracked: 0, profiles_resolved: 0, identity_fragments: 0, commitments: {}, avg_extraction_confidence: 0 }); });
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

      if (!res.ok) { setError(data.error || "Something went wrong. Please try again."); return; }

      setGraph(data.results);
      setLastQuery(query);
      refreshStats();
      setCypherInfo({ cypher: data.cypher, confidence: data.cypher_confidence, interpretation: data.interpretation });
      if (data._trace) setTrace(data._trace);
    } catch {
      setError("Something went wrong. Please try again.");
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
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)", ...(debugMode ? { paddingRight: activityPanelWidth } : {}) }}>
      {/* Header */}
      <header className="border-b px-4 py-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Left: logo + org */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/"><Logo size={44} /></Link>
            <OrgSwitcher currentOrgId={orgId} currentVertical={vertical} />
            <span className="hidden sm:inline text-xs font-semibold bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded capitalize shrink-0">
              {plan}
            </span>
          </div>

          {/* Center: nav */}
          <nav className="hidden md:flex items-center justify-center gap-0.5">
            {[
              { href: "/dashboard/analytics", label: "Analytics" },
              { href: "/dashboard/policies", label: "Drift" },
              { href: "/dashboard/agents", label: "Agents" },
              { href: "/dashboard/commitments", label: "Commitments" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={e => { (e.target as HTMLElement).style.color = "var(--text-primary)"; (e.target as HTMLElement).style.background = "var(--bg-surface-2)"; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.color = "var(--text-secondary)"; (e.target as HTMLElement).style.background = ""; }}
              >{label}</Link>
            ))}
          </nav>

          {/* Right: actions + user */}
          <div className="flex items-center justify-end gap-2">
            {/* Activity Panel toggle */}
            <button
              onClick={() => { setDebugMode(!debugMode); if (!debugMode) setTrace(null); }}
              className={`hidden sm:flex items-center gap-1.5 text-sm px-4 py-2 rounded-full font-medium border transition-all ${
                debugMode
                  ? "bg-purple-600/20 border-purple-500 text-purple-300"
                  : "bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white"
              }`}
            >
              ⚡ Activity
            </button>

            {/* User menu */}
            <div ref={userMenuRef} className="relative pl-2" style={{ borderLeft: "1px solid var(--border)" }}>
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 focus:outline-none hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {session?.user?.name?.[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || "U"}
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-2xl z-50 overflow-hidden theme-card" style={{ boxShadow: "var(--shadow-lg)" }}>
                  {/* User info */}
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {session?.user?.name || session?.user?.email?.split("@")[0] || "User"}
                    </div>
                    <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{session?.user?.email}</div>
                    <div className="mt-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium capitalize ${
                        lsPlan === "enterprise" ? "bg-purple-900/40 text-purple-300" :
                        lsPlan === "pro" ? "bg-blue-900/40 text-blue-300" : ""
                      }`} style={!["enterprise","pro"].includes(lsPlan) ? { background: "var(--bg-surface-2)", color: "var(--text-muted)" } : {}}>
                        {lsPlan || "starter"} plan
                      </span>
                    </div>
                  </div>

                  {/* Mobile nav links */}
                  <div className="md:hidden py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                    {[
                      { href: "/dashboard/analytics", label: "Analytics" },
                      { href: "/dashboard/policies", label: "Drift Analysis" },
                      { href: "/dashboard/agents", label: "Agents" },
                      { href: "/dashboard/commitments", label: "Commitments" },
                    ].map(({ href, label }) => (
                      <Link key={href} href={href} onClick={() => setUserMenuOpen(false)}
                        className="flex items-center px-4 py-2.5 text-sm transition-colors"
                        style={{ color: "var(--text-secondary)" }}>
                        {label}
                      </Link>
                    ))}
                  </div>

                  <div className="py-1">
                    <Link href="/settings" onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: "var(--text-secondary)" }}>
                      <span>⚙️</span> Settings
                    </Link>
                    <Link href="/api-docs" onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: "var(--text-secondary)" }}>
                      <span>📄</span> API Docs
                    </Link>
                  </div>

                  <div className="py-1" style={{ borderTop: "1px solid var(--border)" }}>
                    <button onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors">
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

        {loading && (
          <div className="flex flex-col items-center justify-center py-32 space-y-5">
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="text-xl font-medium animate-pulse" style={{ color: "var(--text-primary)" }}>
              {LOADING_STEPS[loadingStep]}
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
            <div className="text-5xl">🔍</div>
            <h2 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>No results found</h2>
            <p className="text-base max-w-sm" style={{ color: "var(--text-muted)" }}>
              We couldn&apos;t find anything matching your search. Try a different name, email, or event type.
            </p>
          </div>
        )}

        {!loading && filteredGraph && filteredGraph.nodes.length === 0 && !error && lastQuery && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
            <div className="text-5xl">🔎</div>
            <h2 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>No data yet for &quot;{lastQuery}&quot;</h2>
            <p className="text-base max-w-sm" style={{ color: "var(--text-muted)" }}>
              We&apos;re searching connected sources in the background. Try again in a moment, or import data from Settings.
            </p>
          </div>
        )}

        {filteredGraph && filteredGraph.nodes.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {filteredGraph.summary.total_nodes} nodes · {filteredGraph.summary.total_edges} edges
                {Object.values(activeFilters).some(v=>v.length>0) && (
                  <span className="ml-2 text-xs text-emerald-500">filtered</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <ExportButton graph={filteredGraph} insight={insight} query={lastQuery} orgId={orgId} />
                <button
                  onClick={() => handleAnalyze()}
                  className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{ background: "var(--bg-surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                >
                  🧠 Analyze
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
              <div id="export-timeline" className="h-[600px] rounded-xl overflow-hidden flex flex-col theme-card">
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

        {!graph && !loading && !error && stats !== null && (
          (!stats.events_tracked || stats.events_tracked === 0) ? (
            <div className="py-16 flex flex-col items-center">
              <div className="theme-card p-10 max-w-2xl w-full text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto text-3xl">📂</div>
                <div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>No data yet</h2>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Connect a CRM, upload a CSV, or paste JSON to start building context graphs.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-left">
                  {[
                    { icon: "🔌", title: "Connect CRM", desc: "HubSpot, Salesforce, Zendesk", href: "/settings" },
                    { icon: "📄", title: "Upload CSV", desc: "Drag & drop any spreadsheet", href: "/settings" },
                    { icon: "{ }", title: "Paste JSON", desc: "Raw events or API responses", href: "/settings" },
                  ].map(opt => (
                    <Link key={opt.title} href={opt.href}
                      className="theme-card theme-card-hover p-4 rounded-xl flex flex-col gap-1 cursor-pointer">
                      <span className="text-xl">{opt.icon}</span>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{opt.title}</span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{opt.desc}</span>
                    </Link>
                  ))}
                </div>
                <Link href="/settings"
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors">
                  Import Data →
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-24">
              <div className="text-4xl mb-4">🔍</div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Search to Explore</h2>
              <p style={{ color: "var(--text-muted)" }} className="max-w-md mx-auto text-sm">
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
          onWidthChange={setActivityPanelWidth}
        />
      )}

      {showCSVUpload && (
        <CSVUpload
          orgId={orgId}
          vertical={vertical}
          onClose={() => setShowCSVUpload(false)}
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
