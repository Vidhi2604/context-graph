import { GraphNode, GraphEdge, TimelineEntry, GraphResult } from "@/types/graph";
import { VerticalConfig } from "@/types/vertical";

const MAX_EDGES = 300;

export function mapNeo4jToGraph(
  records: Record<string, unknown>[],
  vertical: VerticalConfig,
  centerHint?: string
): GraphResult {
  const nodesMap = new Map<string, GraphNode>();
  const edgesMap = new Map<string, GraphEdge>();

  for (const record of records) {
    for (const [, value] of Object.entries(record)) {
      if (isNeo4jNode(value)) {
        const node = mapNode(value, vertical);
        if (node && !nodesMap.has(node.id)) {
          nodesMap.set(node.id, node);
        }
      }
      if (isNeo4jRelationship(value)) {
        const edge = mapEdge(value);
        if (edge && !edgesMap.has(edge.id)) {
          edgesMap.set(edge.id, edge);
        }
      }
      // Handle path objects
      if (isNeo4jPath(value)) {
        for (const seg of (value as Neo4jPath).segments) {
          const startNode = mapNode(seg.start, vertical);
          const endNode = mapNode(seg.end, vertical);
          const edge = mapEdge(seg.relationship);
          if (startNode && !nodesMap.has(startNode.id)) nodesMap.set(startNode.id, startNode);
          if (endNode && !nodesMap.has(endNode.id)) nodesMap.set(endNode.id, endNode);
          if (edge && !edgesMap.has(edge.id)) edgesMap.set(edge.id, edge);
        }
      }
    }
  }

  const nodes = Array.from(nodesMap.values());
  // Sort by source node relevance descending, cap at MAX_EDGES
  const allEdges = Array.from(edgesMap.values()).sort((a, b) => {
    const relA = nodesMap.get(a.source)?.relevance ?? 0;
    const relB = nodesMap.get(b.source)?.relevance ?? 0;
    return relB - relA;
  });
  const edges = allEdges.length > MAX_EDGES ? allEdges.slice(0, MAX_EDGES) : allEdges;
  const timeline = buildTimeline(nodes);

  // Determine center node
  let centerNodeId = centerHint || "";
  if (!centerNodeId && nodes.length > 0) {
    // Prefer Profile nodes as center
    const profile = nodes.find((n) => n.label === "Profile");
    centerNodeId = profile?.id || nodes[0].id;
  }

  const nodeBreakdown: Record<string, number> = {};
  for (const n of nodes) {
    nodeBreakdown[n.label] = (nodeBreakdown[n.label] || 0) + 1;
  }

  return {
    nodes,
    edges,
    timeline,
    centerNodeId,
    summary: {
      total_nodes: nodes.length,
      total_edges: edges.length,
      node_breakdown: nodeBreakdown,
    },
  };
}

// Convert Neo4j native types (DateTime, Integer) to plain JS values
function sanitizeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "number") return v;

  // Neo4j Integer: { low, high }
  if (typeof v === "object" && "low" in (v as object) && "high" in (v as object)) {
    const obj = v as { low: number; high: number };
    return obj.high === 0 ? obj.low : obj.high * 4294967296 + obj.low;
  }

  // Neo4j DateTime: has year, month, day fields
  if (typeof v === "object" && "year" in (v as object) && "month" in (v as object) && "day" in (v as object)) {
    const dt = v as Record<string, unknown>;
    const y = sanitizeValue(dt.year);
    const mo = sanitizeValue(dt.month);
    const d = sanitizeValue(dt.day);
    const h = sanitizeValue(dt.hour) || 0;
    const mi = sanitizeValue(dt.minute) || 0;
    const s = sanitizeValue(dt.second) || 0;
    return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}T${String(h).padStart(2,"0")}:${String(mi).padStart(2,"0")}:${String(s).padStart(2,"0")}Z`;
  }

  if (Array.isArray(v)) return v.map(sanitizeValue);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as object)) out[k] = sanitizeValue(val);
    return out;
  }
  return String(v);
}

function sanitizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) out[k] = sanitizeValue(v);
  return out;
}

function mapNode(value: unknown, vertical: VerticalConfig): GraphNode | null {
  const node = value as Neo4jNode;
  if (!node.labels || node.labels.length === 0) return null;

  const label = node.labels[0];
  const props = node.properties || {};
  const id = getNodeId(props, label);
  if (!id) return null;

  const color = vertical.colors[label] || "#6b7280";
  const nodeType = vertical.nodeTypes.find((n) => n.label === label);
  const displayName = nodeType
    ? String(props[nodeType.displayName] || label)
    : String(props.name || props.id || label);

  return {
    id,
    label,
    properties: sanitizeProps(props),
    displayName,
    color,
    relevance: typeof props.relevance === "number" ? props.relevance : undefined,
  };
}

function mapEdge(value: unknown): GraphEdge | null {
  const rel = value as Neo4jRelationship;
  if (!rel.type) return null;

  return {
    id: `edge-${rel.start}-${rel.type}-${rel.end}`,
    source: String(rel.start),
    target: String(rel.end),
    type: rel.type,
    properties: rel.properties || {},
  };
}

function getNodeId(props: Record<string, unknown>, label: string): string {
  const idFields = [
    "profile_id", "id", "visit_id", "event_id", "product_id",
    "policy_id", "agent_id", "payment_id", "outcome_id",
    "commitment_id", "identity_id", "diagnosis_id", "treatment_id",
    "medication_id", "provider_id", "claim_id", "protocol_id",
    "department_id", "session_id",
  ];
  for (const f of idFields) {
    if (props[f]) return String(props[f]);
  }
  return `${label}-${JSON.stringify(props).slice(0, 20)}`;
}

function buildTimeline(nodes: GraphNode[]): TimelineEntry[] {
  const eventNodes = nodes.filter((n) =>
    ["Event", "Visit"].includes(n.label) && n.properties.timestamp
  );

  const byDate = new Map<string, GraphNode[]>();
  for (const n of eventNodes) {
    const ts = String(n.properties.timestamp);
    const date = ts.slice(0, 10); // YYYY-MM-DD
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(n);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({
      date,
      events,
      count: events.length,
      totalAmount: events.reduce(
        (sum, e) => sum + (Number(e.properties.amount) || 0), 0
      ),
      topEventType: events[0]?.properties.event_type as string || events[0]?.properties.type as string || "",
    }));
}

// Neo4j driver types
interface Neo4jNode {
  labels: string[];
  properties: Record<string, unknown>;
}

interface Neo4jRelationship {
  type: string;
  start: string | number;
  end: string | number;
  properties: Record<string, unknown>;
}

interface Neo4jPath {
  segments: { start: Neo4jNode; end: Neo4jNode; relationship: Neo4jRelationship }[];
}

function isNeo4jNode(v: unknown): boolean {
  return typeof v === "object" && v !== null && "labels" in v && "properties" in v;
}

function isNeo4jRelationship(v: unknown): boolean {
  return typeof v === "object" && v !== null && "type" in v && "start" in v && "end" in v && !("labels" in v);
}

function isNeo4jPath(v: unknown): boolean {
  return typeof v === "object" && v !== null && "segments" in v;
}
