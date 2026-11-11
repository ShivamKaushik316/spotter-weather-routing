export const LOAD_RULE_THRESHOLDS = [30_000, 40_000] as const;

export interface LoadRuleSummary {
  title: string;
  detail: string;
}

export function describeLoadRules(loadPounds: number): LoadRuleSummary {
  if (loadPounds > LOAD_RULE_THRESHOLDS[1]) {
    return {
      title: "Heavy load rules active.",
      detail: "35–44 mph wind counts as Severe; 45–54 mph is No Travel.",
    };
  }
  if (loadPounds > LOAD_RULE_THRESHOLDS[0]) {
    return { title: "Load rule active.", detail: "45–54 mph wind counts as No Travel." };
  }
  return { title: "Standard thresholds.", detail: "Only wind of 55 mph or more is No Travel." };
}
