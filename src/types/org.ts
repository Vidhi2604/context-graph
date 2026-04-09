export interface OrgSession {
  userId: string;
  orgId: string;
  tenantId: string;
  vertical: string;
  plan: PlanId;
}

export type PlanId = "starter" | "pro" | "enterprise";

export interface PlanConfig {
  name: string;
  eventsPerMonth: number;
  searchType: "basic" | "llm";
  maxGraphNodes: number;
  timelineRangeDays: number;
  insightLevel: "none" | "summary" | "full";
  apiAccess: boolean;
  mcpAccess: boolean;
  maxMembers: number;
}
