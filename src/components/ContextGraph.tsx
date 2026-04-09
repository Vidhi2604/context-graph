"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  ConnectionLineType,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { GraphNode, GraphEdge } from "@/types/graph";

interface ContextGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerNodeId?: string;
  onNodeClick?: (node: GraphNode) => void;
  onNodeDoubleClick?: (node: GraphNode) => void;
}

export default function ContextGraph({
  nodes,
  edges,
  centerNodeId,
  onNodeClick,
  onNodeDoubleClick,
}: ContextGraphProps) {
  const { flowNodes, flowEdges } = useMemo(() => {
    const centerIdx = nodes.findIndex((n) => n.id === centerNodeId);
    const center = centerIdx >= 0 ? centerIdx : 0;

    const fn: Node[] = nodes.map((node, i) => {
      const isCenter = i === center;
      const angle = isCenter ? 0 : ((i - (i > center ? 1 : 0)) / (nodes.length - 1)) * 2 * Math.PI;
      const radius = isCenter ? 0 : 300;
      const relevance = node.relevance ?? 0.7;
      const confidence = node.properties?.confidence_score as number | undefined;
      const policyStatus = node.properties?.status as string | undefined;
      const isSuperseded = policyStatus === "superseded";

      return {
        id: node.id,
        position: {
          x: 400 + radius * Math.cos(angle),
          y: 300 + radius * Math.sin(angle),
        },
        data: {
          label: (
            <div className="text-center relative">
              {confidence != null && (
                <div className="absolute -top-3 -left-3 bg-blue-900/80 text-blue-200 text-[9px] px-1 py-0.5 rounded-full font-mono">
                  {Math.round(confidence * 100)}%
                </div>
              )}
              {node.relevance != null && (
                <div className="absolute -top-3 -right-3 bg-gray-800 text-gray-300 text-[9px] px-1 py-0.5 rounded-full font-mono">
                  {Math.round(relevance * 100)}
                </div>
              )}
              <div className={`font-semibold text-xs ${isSuperseded ? "line-through text-gray-500" : ""}`}>
                {node.displayName}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">{node.label}</div>
              {isSuperseded && (
                <span className="text-[8px] bg-yellow-900/50 text-yellow-400 px-1 rounded">superseded</span>
              )}
            </div>
          ),
        },
        style: {
          background: node.color,
          color: "#fff",
          border: isCenter
            ? "2px solid #10b981"
            : isSuperseded
              ? "1px dashed #6b7280"
              : "none",
          borderRadius: "12px",
          padding: "8px 12px",
          fontSize: "12px",
          minWidth: isCenter ? "140px" : "120px",
          opacity: isSuperseded ? 0.4 : 0.3 + relevance * 0.7,
          boxShadow: isCenter ? "0 0 20px rgba(16,185,129,0.3)" : "none",
        },
      };
    });

    const fe: Edge[] = edges.map((edge, i) => ({
      id: edge.id || `e-${i}`,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      animated: true,
      label: edge.type,
      labelStyle: { fontSize: 9, fill: "#6b7280" },
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#475569", strokeWidth: 1.5 },
    }));

    return { flowNodes: fn, flowEdges: fe };
  }, [nodes, edges, centerNodeId]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        const graphNode = nodes.find((n) => n.id === node.id);
        if (graphNode) onNodeClick(graphNode);
      }
    },
    [nodes, onNodeClick]
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onNodeDoubleClick) {
        const graphNode = nodes.find((n) => n.id === node.id);
        if (graphNode) onNodeDoubleClick(graphNode);
      }
    },
    [nodes, onNodeDoubleClick]
  );

  if (nodes.length === 0) return null;

  return (
    <div className="w-full h-[500px] bg-gray-950 rounded-xl border border-gray-800">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} />
        <Controls className="!bg-gray-800 !border-gray-700" />
        <MiniMap
          nodeColor={(n) => (n.style?.background as string) || "#6b7280"}
          className="!bg-gray-900 !border-gray-700"
        />
      </ReactFlow>
    </div>
  );
}
