import type { RiskLevelLabel } from "@/shared/api/types";

export type RiskLevelKey = RiskLevelLabel | "Unknown";

export interface RiskLevelDefinition {
  key: RiskLevelKey;
  color: string;
  cssColor: string;
  score: number | null;
}

export const RISK_LEVELS: readonly RiskLevelDefinition[] = [
  { key: "Low", color: "#22C55E", cssColor: "var(--risk-low)", score: 0 },
  { key: "Moderate", color: "#EAB308", cssColor: "var(--risk-moderate)", score: 1 },
  { key: "High", color: "#F97316", cssColor: "var(--risk-high)", score: 2 },
  { key: "Severe", color: "#EF4444", cssColor: "var(--risk-severe)", score: 3 },
  { key: "No Travel", color: "#A855F7", cssColor: "var(--risk-no-travel)", score: 4 },
  { key: "Unknown", color: "#64748B", cssColor: "var(--risk-unknown)", score: null },
];

const RISK_LEVEL_BY_KEY = new Map(RISK_LEVELS.map((level) => [level.key, level]));

export function riskLevelKey(level: RiskLevelLabel | null | undefined): RiskLevelKey {
  return level ?? "Unknown";
}

export function riskDefinition(level: RiskLevelLabel | null | undefined): RiskLevelDefinition {
  return RISK_LEVEL_BY_KEY.get(riskLevelKey(level)) ?? (RISK_LEVELS[5] as RiskLevelDefinition);
}

export function riskColor(level: RiskLevelLabel | null | undefined): string {
  return riskDefinition(level).color;
}

export function milesAtLevel(
  milesByLevel: Readonly<Record<string, number>>,
  level: RiskLevelLabel,
): number {
  return milesByLevel[level] ?? 0;
}
