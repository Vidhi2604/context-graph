import { v4 as uuidv4 } from "uuid";

// ── Types ──────────────────────────────────────────────────────────

export type TraceLayer = "auth" | "validation" | "llm" | "neo4j" | "mapping" | "scoring" | "kafka" | "streams";
export type TraceStatus = "success" | "skipped" | "error";
export type TraceAction = "search" | "event_ingest" | "transcript" | "insight" | "agent_context" | "connector_sync" | "explore";

export interface TraceStep {
  step_number: number;
  name: string;
  fn: string;
  layer: TraceLayer;
  duration_ms: number;
  status: TraceStatus;
  input_summary?: string;
  output_summary?: string;
  detail?: Record<string, unknown>;
  error?: string;
}

export interface PipelineTrace {
  trace_id: string;
  action: TraceAction;
  trigger: string;
  started_at: string;
  completed_at: string;
  total_ms: number;
  status: "success" | "partial" | "error";
  steps: TraceStep[];
}

// ── Collector ──────────────────────────────────────────────────────

export class TraceCollector {
  private steps: TraceStep[] = [];
  private startTime = Date.now();

  /** Wrap a pipeline step — measures timing, captures input/output, handles errors */
  async run<T>(
    name: string,
    fn: string,
    layer: TraceLayer,
    inputSummary: string,
    execute: () => Promise<T>
  ): Promise<T> {
    const stepStart = Date.now();
    const stepNumber = this.steps.length + 1;

    try {
      const result = await execute();
      this.steps.push({
        step_number: stepNumber,
        name,
        fn,
        layer,
        duration_ms: Date.now() - stepStart,
        status: "success",
        input_summary: inputSummary,
        output_summary: summarize(result),
      });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.steps.push({
        step_number: stepNumber,
        name,
        fn,
        layer,
        duration_ms: Date.now() - stepStart,
        status: "error",
        input_summary: inputSummary,
        error: message,
      });
      throw error;
    }
  }

  /** Add a skipped step (e.g., feature not enabled for this plan) */
  skip(name: string, fn: string, layer: TraceLayer, reason: string): void {
    this.steps.push({
      step_number: this.steps.length + 1,
      name,
      fn,
      layer,
      duration_ms: 0,
      status: "skipped",
      input_summary: reason,
    });
  }

  /** Finalize and return the full trace */
  finalize(action: TraceAction, trigger: string): PipelineTrace {
    const hasError = this.steps.some((s) => s.status === "error");
    const allSuccess = this.steps.every((s) => s.status !== "error");
    return {
      trace_id: `trace_${uuidv4().slice(0, 8)}`,
      action,
      trigger,
      started_at: new Date(this.startTime).toISOString(),
      completed_at: new Date().toISOString(),
      total_ms: Date.now() - this.startTime,
      status: hasError ? "error" : allSuccess ? "success" : "partial",
      steps: this.steps,
    };
  }

  get stepCount() { return this.steps.length; }
}

// ── Helpers ────────────────────────────────────────────────────────

function summarize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value.slice(0, 120);
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    const first = JSON.stringify(value[0]) ?? "";
    return `[${value.length} items] ${first.slice(0, 80)}...`;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    // Pick most meaningful fields
    const summary: Record<string, unknown> = {};
    const priorityKeys = ["nodes", "edges", "cypher", "query", "profile_id", "total_ms",
      "event_type", "profileId", "isNew", "merged", "count", "total", "status",
      "finding", "confidence", "records", "length", "name", "type"];
    for (const k of priorityKeys) {
      if (k in obj) {
        const v = obj[k];
        summary[k] = Array.isArray(v) ? `[${v.length}]` : v;
      }
    }
    if (Object.keys(summary).length === 0) {
      // Fallback: first 3 keys
      for (const k of keys.slice(0, 3)) summary[k] = obj[k];
    }
    return JSON.stringify(summary).slice(0, 200);
  }

  return String(value).slice(0, 120);
}

// ── Layer Colors (used in TracePanel) ─────────────────────────────

export const LAYER_COLORS: Record<TraceLayer, string> = {
  auth:       "#6b7280",  // gray
  validation: "#3b82f6",  // blue
  llm:        "#8b5cf6",  // purple
  neo4j:      "#10b981",  // emerald
  mapping:    "#f97316",  // orange
  scoring:    "#14b8a6",  // teal
  kafka:      "#eab308",  // yellow
  streams:    "#f59e0b",  // amber
};

export const LAYER_LABELS: Record<TraceLayer, string> = {
  auth:       "Auth",
  validation: "Validation",
  llm:        "LLM",
  neo4j:      "Neo4j",
  mapping:    "Mapping",
  scoring:    "Scoring",
  kafka:      "Kafka",
  streams:    "Redis",
};
