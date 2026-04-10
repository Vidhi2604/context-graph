"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { GraphNode, GraphEdge } from "@/types/graph";

interface ContextGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  query: string;
  centerNodeId?: string;
  similarSourceId?: string | null;
  onNodeClick?: (node: GraphNode) => void;
  onNodeDoubleClick?: (node: GraphNode) => void;
}

const LABEL_COLORS: Record<string, string> = {
  SEARCH:         "#7c3aed",
  Profile:        "#10b981",
  Event:          "#3b82f6",
  Visit:          "#3b82f6",
  Product:        "#8b5cf6",
  Policy:         "#eab308",
  Protocol:       "#eab308",
  Agent:          "#14b8a6",
  Provider:       "#14b8a6",
  Payment:        "#f97316",
  Outcome:        "#ec4899",
  Diagnosis:      "#ef4444",
  Treatment:      "#a855f7",
  Commitment:     "#f43f5e",
  InsuranceClaim: "#fb923c",
  Department:     "#6366f1",
  Medication:     "#06b6d4",
  Identity:       "#374151",
};

function getColor(label: string): string {
  return LABEL_COLORS[label] || "#6b7280";
}

function getRing(label: string): number {
  if (label === "Profile") return 1;
  if (label === "Event" || label === "Visit") return 2;
  if (label === "Identity") return 5;
  return 3;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function computeGridLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  searchQuery: string,
  SEARCH_ID: string
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const flowNodes: Node[] = [];

  // Center search node
  flowNodes.push({
    id: SEARCH_ID,
    position: { x: 0, y: 0 },
    data: {
      label: (
        <div className="text-center px-2">
          <div className="text-[9px] text-purple-300 mb-0.5 tracking-widest uppercase">Search</div>
          <div className="font-semibold text-[11px] text-white leading-tight max-w-[110px] break-words">
            {searchQuery.length > 35 ? searchQuery.slice(0, 35) + "…" : searchQuery}
          </div>
        </div>
      ),
    },
    style: {
      background: "radial-gradient(circle, #5b21b6, #4c1d95)",
      border: "2px solid #7c3aed",
      borderRadius: "50%",
      width: 120,
      height: 120,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      boxShadow: "0 0 30px rgba(124,58,237,0.4)",
    },
  });

  // Group by label for clean grid sections
  const byLabel: Record<string, GraphNode[]> = {};
  for (const n of nodes) {
    if (n.label === "Identity") continue;
    if (!byLabel[n.label]) byLabel[n.label] = [];
    byLabel[n.label].push(n);
  }

  const COL_WIDTH = 160;
  const ROW_HEIGHT = 110;
  const COLS = 5;
  let col = 0;
  let row = 0;
  const startX = -((COLS - 1) * COL_WIDTH) / 2;

  for (const [label, labelNodes] of Object.entries(byLabel)) {
    for (const node of labelNodes) {
      const color = getColor(label);
      const isProfile = label === "Profile";
      const size = isProfile ? 80 : 64;
      const x = startX + col * COL_WIDTH;
      const y = 200 + row * ROW_HEIGHT;

      flowNodes.push({
        id: node.id,
        position: { x, y },
        data: {
          label: (
            <div className="text-center px-1">
              <div className="text-[8px] opacity-50 mb-0.5 uppercase tracking-wide">{label}</div>
              <div className="font-semibold text-[10px] leading-tight max-w-[60px] break-words">
                {String(node.displayName || label).slice(0, 16)}
              </div>
            </div>
          ),
        },
        style: {
          background: `${color}18`,
          border: `1.5px solid ${color}60`,
          borderRadius: isProfile ? "50%" : "12px",
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
        },
      });

      col++;
      if (col >= COLS) { col = 0; row++; }
    }
  }

  // Edges (even if few)
  const flowEdges: Edge[] = edges.slice(0, 100).map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.type?.replace(/_/g, " ").toLowerCase(),
    style: { stroke: "#374151", strokeWidth: 1 },
    labelStyle: { fontSize: 8, fill: "#6b7280" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#374151" },
  }));

  return { flowNodes, flowEdges };
}

function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  searchQuery: string
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const SEARCH_ID = "__search__";

  // Cap nodes for performance + readability
  const MAX_NODES = 60;
  // Prioritise: profiles first, then events/visits, then rest
  const sorted = [
    ...nodes.filter(n => n.label === "Profile"),
    ...nodes.filter(n => n.label === "Event" || n.label === "Visit"),
    ...nodes.filter(n => !["Profile","Event","Visit"].includes(n.label)),
  ].slice(0, MAX_NODES);

  // Group by ring
  const rings: Record<number, string[]> = { 0: [SEARCH_ID] };
  for (const n of sorted) {
    const ring = getRing(n.label);
    if (!rings[ring]) rings[ring] = [];
    rings[ring].push(n.id);
  }

  const RING_RADII: Record<number, number> = { 0: 0, 1: 220, 2: 420, 3: 600, 4: 780, 5: 950 };
  const positions: Record<string, { x: number; y: number }> = {};
  positions[SEARCH_ID] = { x: 0, y: 0 };

  // Position ring 1 (profiles) evenly around center
  // Position ring 2+ based on which profile they connect to, for better clustering
  const profileAngles: Record<string, number> = {};
  const profileNodes = sorted.filter(n => n.label === "Profile");

  profileNodes.forEach((p, idx) => {
    const angle = (2 * Math.PI * idx) / Math.max(profileNodes.length, 1) - Math.PI / 2;
    profileAngles[p.id] = angle;
    positions[p.id] = {
      x: Math.cos(angle) * RING_RADII[1],
      y: Math.sin(angle) * RING_RADII[1],
    };
  });

  // Build adjacency: which profile does each node connect to?
  const nodeToProfile: Record<string, string> = {};
  for (const e of edges) {
    const srcIsProfile = sorted.find(n => n.id === e.source && n.label === "Profile");
    if (srcIsProfile) nodeToProfile[e.target] = e.source;
  }

  const ring2Nodes = sorted.filter(n => getRing(n.label) === 2);
  const ring2ByProfile: Record<string, string[]> = {};
  for (const n of ring2Nodes) {
    const parentProfile = nodeToProfile[n.id] || profileNodes[0]?.id || "";
    if (!ring2ByProfile[parentProfile]) ring2ByProfile[parentProfile] = [];
    ring2ByProfile[parentProfile].push(n.id);
  }

  for (const [profileId, childIds] of Object.entries(ring2ByProfile)) {
    const baseAngle = profileAngles[profileId] ?? 0;
    const spread = Math.PI / 3;
    childIds.forEach((id, idx) => {
      const offset = childIds.length > 1 ? spread * (idx / (childIds.length - 1) - 0.5) : 0;
      positions[id] = {
        x: Math.cos(baseAngle + offset) * RING_RADII[2],
        y: Math.sin(baseAngle + offset) * RING_RADII[2],
      };
    });
  }

  const ring3Nodes = sorted.filter(n => getRing(n.label) === 3);
  const nodeToRing2: Record<string, string> = {};
  for (const e of edges) {
    const srcRing = sorted.find(n => n.id === e.source);
    if (srcRing && getRing(srcRing.label) === 2) nodeToRing2[e.target] = e.source;
  }

  const ring3ByParent: Record<string, string[]> = {};
  for (const n of ring3Nodes) {
    if (positions[n.id]) continue;
    const parent = nodeToRing2[n.id];
    if (!ring3ByParent[parent || ""]) ring3ByParent[parent || ""] = [];
    ring3ByParent[parent || ""].push(n.id);
  }

  for (const [parentId, childIds] of Object.entries(ring3ByParent)) {
    const parentPos = positions[parentId] || { x: 0, y: 0 };
    const parentAngle = Math.atan2(parentPos.y, parentPos.x);
    const spread = Math.PI / 4;
    childIds.forEach((id, idx) => {
      if (positions[id]) return;
      const offset = childIds.length > 1 ? spread * (idx / (childIds.length - 1) - 0.5) : 0;
      positions[id] = {
        x: Math.cos(parentAngle + offset) * RING_RADII[3],
        y: Math.sin(parentAngle + offset) * RING_RADII[3],
      };
    });
  }

  // Fallback: any node not yet positioned
  const unpositioned = sorted.filter(n => !positions[n.id]);
  unpositioned.forEach((n, idx) => {
    const angle = (2 * Math.PI * idx) / Math.max(unpositioned.length, 1);
    positions[n.id] = {
      x: Math.cos(angle) * RING_RADII[3],
      y: Math.sin(angle) * RING_RADII[3],
    };
  });

  // ── Flow nodes ──────────────────────────────────────────────────

  const flowNodes: Node[] = [];

  // Center search node
  flowNodes.push({
    id: SEARCH_ID,
    position: { x: 0, y: 0 },
    data: {
      label: (
        <div className="text-center px-2">
          <div className="text-[9px] text-purple-300 mb-0.5 tracking-widest uppercase">Search</div>
          <div className="font-semibold text-[11px] text-white leading-tight max-w-[110px] break-words">
            {searchQuery.length > 35 ? searchQuery.slice(0, 35) + "…" : searchQuery}
          </div>
        </div>
      ),
    },
    style: {
      background: "radial-gradient(circle, #5b21b6, #4c1d95)",
      border: "2px solid #7c3aed",
      borderRadius: "50%",
      width: 130,
      height: 130,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      boxShadow: "0 0 40px rgba(124,58,237,0.4)",
    },
  });

  // Data nodes
  for (const node of sorted) {
    if (node.label === "Identity") continue; // hide identity nodes from graph
    const pos = positions[node.id] || { x: 0, y: 0 };
    const color = getColor(node.label);
    const isProfile = node.label === "Profile";
    const isEvent = node.label === "Event" || node.label === "Visit";
    const isSuperseded = node.properties?.status === "superseded";
    const relevance = node.relevance ?? 0.7;
    const confidence = node.properties?.confidence_score as number | undefined;

    const size = isProfile ? 90 : isEvent ? 72 : 60;

    flowNodes.push({
      id: node.id,
      position: pos,
      data: {
        label: (
          <div className="text-center px-1">
            <div className="text-[8px] opacity-50 mb-0.5 uppercase tracking-wide">{node.label}</div>
            <div
              className="font-semibold text-[10px] leading-tight max-w-[70px] break-words"
              style={{ textDecoration: isSuperseded ? "line-through" : "none", opacity: isSuperseded ? 0.6 : 1 }}
            >
              {String(node.displayName || node.label).slice(0, 18)}
            </div>
            {confidence != null && (
              <div className="text-[7px] opacity-40 mt-0.5">{Math.round(confidence * 100)}%</div>
            )}
            {isSuperseded && (
              <div className="text-[7px] text-yellow-300 mt-0.5">superseded</div>
            )}
          </div>
        ),
      },
      style: {
        background: isSuperseded ? "#374151" : color,
        border: isProfile
          ? `2px solid ${color}`
          : isSuperseded
            ? "1px dashed #6b7280"
            : "none",
        borderRadius: isProfile ? "50%" : "10px",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        opacity: isSuperseded ? 0.4 : Math.max(0.5, 0.3 + relevance * 0.7),
        boxShadow: isProfile ? `0 0 20px ${color}50` : "none",
        fontSize: "11px",
        cursor: "pointer",
      },
    });
  }

  // ── Flow edges ──────────────────────────────────────────────────

  const flowEdges: Edge[] = [];

  // Search → Profile edges
  for (const n of nodes.filter(n => n.label === "Profile")) {
    flowEdges.push({
      id: `search-${n.id}`,
      source: SEARCH_ID,
      target: n.id,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#7c3aed", strokeWidth: 1.5, strokeDasharray: "6,3" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#7c3aed", width: 12, height: 12 },
    });
  }

  // Data edges
  const edgeColors: Record<string, string> = {
    PERFORMED: "#10b981",
    HAD_VISIT: "#10b981",
    INVOLVES: "#8b5cf6",
    PAID_VIA: "#f97316",
    GOVERNED_BY: "#eab308",
    OVERRODE: "#ef4444",
    DEVIATED_FROM: "#ef4444",
    HANDLED_BY: "#14b8a6",
    ATTENDED_BY: "#14b8a6",
    DIAGNOSED_WITH: "#ef4444",
    TREATED_WITH: "#a855f7",
    RESULTED_IN: "#ec4899",
    CLAIMED_VIA: "#fb923c",
    HAS_COMMITMENT: "#f43f5e",
    CREATED_COMMITMENT: "#f43f5e",
    IN_DEPARTMENT: "#6366f1",
    SUPERSEDED_BY: "#6b7280",
  };

  for (const edge of edges) {
    // Skip edges to identity nodes
    const targetNode = nodes.find(n => n.id === edge.target);
    if (targetNode?.label === "Identity") continue;

    const edgeColor = edgeColors[edge.type] || "#374151";
    flowEdges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      label: edge.type?.replace(/_/g, " "),
      labelStyle: { fontSize: 8, fill: "#9ca3af", fontFamily: "monospace" },
      labelBgStyle: { fill: "#111827", fillOpacity: 0.8 },
      labelBgPadding: [2, 4] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 10, height: 10 },
      style: { stroke: edgeColor, strokeWidth: 1.2 },
    });
  }

  return { flowNodes, flowEdges };
}

export default function ContextGraph({
  nodes,
  edges,
  query,
  similarSourceId,
  onNodeClick,
  onNodeDoubleClick,
}: ContextGraphProps) {
  const { flowNodes: rawFlowNodes, flowEdges: rawFlowEdges } = useMemo(
    () => computeLayout(nodes, edges, query),
    [nodes, edges, query]
  );

  // When showing similar results, tint all nodes orange/amber to distinguish
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!similarSourceId) return { flowNodes: rawFlowNodes, flowEdges: rawFlowEdges };
    // Orange palette for similar context nodes
    const tintedNodes = rawFlowNodes.map(n => {
      if (n.id === "__search__") return n; // keep search node purple
      return {
        ...n,
        style: {
          ...n.style,
          background: n.style?.background?.toString().includes("5b21b6") ? n.style.background
            : `${String(n.style?.background || "#1f2937").replace(/0x[\da-f]+/gi, "")}`,
          border: "1.5px solid #f97316",
          boxShadow: "0 0 8px rgba(249,115,22,0.3)",
        },
      };
    });
    const tintedEdges = rawFlowEdges.map(e => ({
      ...e,
      style: { ...e.style, stroke: "#f97316", opacity: 0.7 },
    }));
    return { flowNodes: tintedNodes, flowEdges: tintedEdges };
  }, [rawFlowNodes, rawFlowEdges, similarSourceId]);

  const [rfNodes, , onNodesChange] = useNodesState(flowNodes);
  const [rfEdges, , onEdgesChange] = useEdgesState(flowEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id === "__search__") return;
      const graphNode = nodes.find(n => n.id === node.id);
      if (graphNode && onNodeClick) onNodeClick(graphNode);
    },
    [nodes, onNodeClick]
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id === "__search__") return;
      const graphNode = nodes.find(n => n.id === node.id);
      if (graphNode && onNodeDoubleClick) onNodeDoubleClick(graphNode);
    },
    [nodes, onNodeDoubleClick]
  );

  if (nodes.length === 0) return null;

  return (
    <div className="w-full h-[600px] bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.25, minZoom: 0.1, maxZoom: 2 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.05}
        maxZoom={3}
        nodesDraggable={true}
        elementsSelectable={true}
      >
        <Background color="#1e293b" gap={28} />
        <Controls
          className="!bg-gray-800 !border-gray-700"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
