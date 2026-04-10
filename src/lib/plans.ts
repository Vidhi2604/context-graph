import { PlanConfig, PlanId } from "@/types/org";

export const PLANS: Record<PlanId, PlanConfig> = {
  starter: {
    name: "Starter",
    eventsPerMonth: 1000,
    searchType: "basic",
    maxGraphNodes: 25,
    timelineRangeDays: 7,
    insightLevel: "none",
    apiAccess: false,
    mcpAccess: false,
    maxMembers: 1,
    auditExport: false,
    phiAccess: false,
    patternDiscovery: false,
  },
  pro: {
    name: "Pro",
    eventsPerMonth: 10000,
    searchType: "llm",
    maxGraphNodes: 100,
    timelineRangeDays: 90,
    insightLevel: "summary",
    apiAccess: true,
    mcpAccess: false,
    maxMembers: 5,
    auditExport: false,
    phiAccess: false,
    patternDiscovery: false,
  },
  enterprise: {
    name: "Enterprise",
    eventsPerMonth: Infinity,
    searchType: "llm",
    maxGraphNodes: Infinity,
    timelineRangeDays: Infinity,
    insightLevel: "full",
    apiAccess: true,
    mcpAccess: true,
    maxMembers: Infinity,
    auditExport: true,
    phiAccess: true,
    patternDiscovery: true,
  },
};

export function canUseFeature(plan: PlanId, feature: keyof PlanConfig): boolean {
  const config = PLANS[plan];
  const value = config[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value !== "none";
  return false;
}

export function getPlanLimits(plan: PlanId): PlanConfig {
  return PLANS[plan];
}

// Alias used by audit export + HIPAA module
export function getPlanFeatures(plan: string): PlanConfig {
  return PLANS[(plan as PlanId)] || PLANS.starter;
}
