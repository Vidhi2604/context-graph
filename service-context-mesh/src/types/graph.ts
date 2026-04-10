export interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, unknown>;
  displayName: string;
  color: string;
  relevance?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface TimelineEntry {
  date: string;
  events: GraphNode[];
  count: number;
  totalAmount: number;
  topEventType: string;
}

export interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  timeline: TimelineEntry[];
  centerNodeId: string;
  summary: {
    total_nodes: number;
    total_edges: number;
    node_breakdown: Record<string, number>;
  };
}

export interface InsightResponse {
  context: {
    summary: string;
    data_points: string[];
    graph_scope: string;
  };
  reasoning: {
    step: number;
    observation: string;
    implication: string;
    confidence: number;
  }[];
  result: {
    finding: string;
    recommendation: string;
    confidence: number;
    impact: string;
  };
}

export interface AgentContextResponse {
  profile: Record<string, unknown>;
  recent_events: {
    type: string;
    properties: Record<string, unknown>;
    days_ago: number;
    relevance: number;
    confidence: number;
  }[];
  open_commitments: {
    promise: string;
    deadline: string;
    status: string;
    assignee: string;
  }[];
  active_exceptions: {
    policy: string;
    exception: string;
    reason: string;
  }[];
  similar_cases: {
    profile: string;
    similarity: number;
    outcome: string;
  }[];
  risk_score: number;
  risk_signals: string[];
  suggested_actions: {
    action: string;
    confidence: number;
  }[];
}
