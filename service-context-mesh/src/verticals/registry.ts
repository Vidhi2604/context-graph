import { VerticalConfig } from "@/types/vertical";
import { retailVertical } from "./retail/schema";
import { healthcareVertical } from "./healthcare/schema";

const VERTICALS: Record<string, VerticalConfig> = {
  retail: retailVertical,
  healthcare: healthcareVertical,
};

export function getVertical(id: string): VerticalConfig {
  const v = VERTICALS[id];
  if (!v) throw new Error(`Unknown vertical: ${id}`);
  return v;
}

export function getAllVerticals(): VerticalConfig[] {
  return Object.values(VERTICALS);
}

export function getVerticalIds(): string[] {
  return Object.keys(VERTICALS);
}
