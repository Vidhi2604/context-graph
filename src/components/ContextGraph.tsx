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
  onNodeClick?: (node: GraphNode) => void;
  onNodeDoubleClick?: (node: GraphNode) => void;
}

// Node colors by label
const LABEL_COLORS: Record<string, string> = {
  SEARCH: "#7c3aed",      // purple — center
  Profile: "#10b981",     // emerald
  Event: "#3b82f6",       // blue
  Visit: "#3b82f6",       // blue
  Product: "#8b5cf6",     // violet
  Policy: "#eab308",      // yellow
  Protocol: "#eab308",    // yellow
  Agent: "#14b8a6",       // teal
  Provider: "#14b8a6",    // teal
  Payment: "#f97316",     // orange
  Outcome: "#ec4899",     // pink
  Diagnosis: "#ef4444",   // red
  Treatment: "#a855f7",   // purple
  Commitment: "#f43f5e",  // rose
  InsuranceClaim: "#fb923c", // orange
  Department: "#6366f1",  // indigo
  Medication: "#06b6d4",  // cyan
  Identity: "#6b7280",    // gray
};

function getColor(label: string): string {
  return LABEL_COLORS[label] || "#6b7280";
}

// Radial layout — center at (0,0), nodes in rings by hop distance
function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  searchQuery: string
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const SEARCH_ID = "__search__";

  // Assign ring by node type
  const getRing = (label: string): number => {
    if (label === "Profile") return 1;
    if (label === "Event" || label === "Visit") return 2;
    if (label === "Identity") return 4; // hide identity far out
    return 3;
  };

  // Group nodes by ring using plain object
  const rings: Record<number, string[]> = {};
  rings[0] = [SEARCH_ID];
  for (const n of nodes) {
    const ring = getRing(n.label);
    if (!rings[ring]) rings[ring] = [];
    rings[ring].push(n.id);
  }

  const RING_RADII: Record<number, number> = { 0: 0, 1: 220, 2: 420, 3: 600, 4: 800 };
  const positions: Record<string, { x: number; y: number }> = {};
  positions[SEARCH_ID] = { x: 0, y: 0 };

  Object.entries(rings).forEach(([ringStr, ids]) => {
    const ring = Number(ringStr);
    if (ring === 0) return;
    const radius = RING_RADII[ring] || ring * 200;
    const count = ids.length;
    ids.forEach((id: string, idx: number) => {
      const angle = (2 * Math.PI * idx) / count - Math.PI / 2;
      positions[id] = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });
  });

  // Build flow nodes
  const flowNodes: Node[] = [];

  // Center search node
  flowNodes.push({
    id: SEARCH_ID,
    position: { x: 0, y: 0 },
    data: {
      label: (
        <div className="text-center px-1">
          <div className="text-[9px] text-purple-300 mb-0.5">SEARCH</div>
          <div className="font-semibold text-xs text-white leading-tight max-w-[120px] break-words">
            {searchQuery.length > 40 ? searchQuery.slice(0, 40) + "…" : searchQuery}
          </div>
        </div>
      ),
    },
    style: {
      background: "#4c1d95",
      border: "2px solid #7c3aed",
      borderRadius: "50%",
      width: 130,
      height: 130,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      boxShadow: "0 0 30px rgba(124,58,237,0.5)",
    },
  });

  // Other nodes
  for (const node of nodes) {
    const pos = positions[node.id] || { x: 0, y: 0 };
    const color = getColor(node.label);
    const isProfile = node.label === "Profile";
    const isEvent = ["Event", "Visit"].includes(node.label);
    const size = isProfile ? 90 : isEvent ? 75 : 65;
    const isSuperseded = node.properties?.status === "superseded";

    flowNodes.push({
      id: node.id,
      position: pos,
      data: {
        label: (
          <div className="text-center px-1">
            <div className="text-[8px] opacity-60 mb-0.5">{node.label}</div>
            <div
              className="font-semibold text-[10px] leading-tight max-w-[80px] break-words"
              style={{ textDecoration: isSuperseded ? "line-through" : "none" }}
            >
              {String(node.displayName || node.label).slice(0, 20)}
            </div>
            {node.relevance != null && (
              <div className="text-[8px] opacity-50 mt-0.5">{Math.round(node.relevance * 100)}</div>
            )}
          </div>
        ),
      },
      style: {
        background: color,
        border: isSuperseded ? "1px dashed #6b7280" : `1px solid ${color}`,
        borderRadius: isProfile ? "50%" : "12px",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        opacity: isSuperseded ? 0.4 : 0.9,
        boxShadow: isProfile ? `0 0 15px ${color}40` : "none",
        fontSize: "11px",
      },
    });
  }

  // Build flow edges
  const flowEdges: Edge[] = [];

  // Search → Profile edges
  for (const node of nodes.filter(n => n.label === "Profile")) {
    flowEdges.push({
      id: `search-${node.id}`,
      source: SEARCH_ID,
      target: node.id,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#7c3aed", strokeWidth: 2, strokeDasharray: "5,3" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#7c3aed" },
    });
  }

  // Data edges
  for (const edge of edges) {
    flowEdges.push({
      id: edge.id || `${edge.source}-${edge.type}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      label: edge.type?.replace(/_/g, " "),
      labelStyle: { fontSize: 8, fill: "#9ca3af" },
      labelBgStyle: { fill: "#111827", fillOpacity: 0.7 },
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#374151", strokeWidth: 1.5 },
    });
  }

  return { flowNodes, flowEdges };
}

export default function ContextGraph({
  nodes,
  edges,
  query,
  onNodeClick,
  onNodeDoubleClick,
}: ContextGraphProps) {
  const { flowNodes, flowEdges } = useMemo(
    () => computeLayout(nodes, edges, query),
    [nodes, edges, query]
  );

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
    <div className="w-full h-[600px] bg-gray-950 rounded-xl border border-gray-800">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={3}
      >
        <Background color="#1e293b" gap={24} />
        <Controls className="!bg-gray-800 !border-gray-700" />
      </ReactFlow>
    </div>
  );
}
