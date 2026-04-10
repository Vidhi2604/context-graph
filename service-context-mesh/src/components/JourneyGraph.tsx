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

interface EventNode {
  id: string;
  event_type: string;
  timestamp: string;
  properties: Record<string, unknown>;
  session_id: string | null;
}

interface JourneyGraphProps {
  events: EventNode[];
  onNodeClick?: (event: EventNode) => void;
}

const EVENT_COLORS: Record<string, string> = {
  app_install: "#10b981",
  page_view: "#6366f1",
  product_view: "#8b5cf6",
  search: "#f59e0b",
  add_to_cart: "#3b82f6",
  remove_from_cart: "#ef4444",
  begin_checkout: "#f97316",
  add_payment_info: "#eab308",
  purchase: "#22c55e",
  delivery_scheduled: "#06b6d4",
  delivery_completed: "#14b8a6",
  return_initiated: "#f43f5e",
  return_completed: "#e11d48",
  refund_issued: "#dc2626",
  support_ticket: "#a855f7",
  review_submitted: "#84cc16",
};

function getColor(eventType: string): string {
  return EVENT_COLORS[eventType] || "#6b7280";
}

export default function JourneyGraph({
  events,
  onNodeClick,
}: JourneyGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = events.map((evt, i) => ({
      id: evt.id,
      position: { x: 250 * i, y: 100 + Math.sin(i * 0.8) * 60 },
      data: {
        label: (
          <div className="text-center">
            <div className="font-semibold text-xs">
              {evt.event_type.replace(/_/g, " ")}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {new Date(evt.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ),
      },
      style: {
        background: getColor(evt.event_type),
        color: "#fff",
        border: "none",
        borderRadius: "12px",
        padding: "8px 12px",
        fontSize: "12px",
        minWidth: "120px",
      },
    }));

    const e: Edge[] = events.slice(1).map((evt, i) => ({
      id: `edge-${i}`,
      source: events[i].id,
      target: evt.id,
      type: "smoothstep",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#475569", strokeWidth: 2 },
    }));

    return { nodes: n, edges: e };
  }, [events]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        const event = events.find((e) => e.id === node.id);
        if (event) onNodeClick(event);
      }
    },
    [events, onNodeClick]
  );

  return (
    <div className="w-full h-[600px] bg-gray-950 rounded-xl border border-gray-800">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} />
        <Controls className="!bg-gray-800 !border-gray-700" />
        <MiniMap
          nodeColor={(n) => n.style?.background as string || "#6b7280"}
          className="!bg-gray-900 !border-gray-700"
        />
      </ReactFlow>
    </div>
  );
}
