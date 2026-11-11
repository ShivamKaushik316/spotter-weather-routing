import { useState } from "react";
import { useTripPlan } from "@/entities/trip";
import { AlertIcon, CloseIcon } from "@/shared/ui/icons";
import { Panel } from "@/shared/ui/Panel";

export function WarningBanner() {
  const { data: plan } = useTripPlan();
  const [dismissedPlan, setDismissedPlan] = useState<object | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const warnings = plan?.warnings ?? [];

  if (!plan || warnings.length === 0 || dismissedPlan === plan) return null;

  const [firstWarning, ...otherWarnings] = warnings;

  return (
    <Panel
      role="status"
      className="warning-banner absolute left-[424px] top-4 flex max-w-[480px] items-start gap-2.5 border-risk-no-travel/40 px-3.5 py-2.5 text-[13px]"
    >
      <span className="grid size-[26px] flex-none place-items-center rounded-lg bg-risk-no-travel/15 text-risk-no-travel">
        <AlertIcon size={14} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p>{firstWarning}</p>
        {isExpanded && (
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-muted">
            {otherWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        {otherWarnings.length > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            aria-expanded={isExpanded}
            className="mt-1 text-xs font-semibold text-accent hover:underline"
          >
            {isExpanded ? "Show less" : `+${otherWarnings.length} more`}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissedPlan(plan)}
        aria-label="Dismiss warnings"
        className="mt-1 text-muted hover:text-ink"
      >
        <CloseIcon size={14} />
      </button>
    </Panel>
  );
}
