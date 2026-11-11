import { useId } from "react";
import { Chip } from "@/shared/ui/Chip";
import { SectionLabel } from "@/shared/ui/SectionLabel";
import { formatPounds } from "@/shared/lib/format";
import { describeLoadRules, LOAD_RULE_THRESHOLDS } from "./loadRules";
import { MAXIMUM_LOAD_POUNDS } from "./tripSchema";

const LOAD_STEP_POUNDS = 500;
const LOAD_PRESETS = [
  { label: "Empty", pounds: 0 },
  { label: "Half", pounds: 40_000 },
  { label: "Full 80k", pounds: 80_000 },
] as const;

interface LoadFieldProps {
  loadPounds: number;
  onChange: (loadPounds: number) => void;
}

export function LoadField({ loadPounds, onChange }: LoadFieldProps) {
  const sliderId = useId();
  const hintId = useId();
  const loadRules = describeLoadRules(loadPounds);

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <SectionLabel className="mb-0">
          <label htmlFor={sliderId}>Load weight</label>
        </SectionLabel>
        <output htmlFor={sliderId} className="font-mono text-xl font-semibold tabular-nums">
          {formatPounds(loadPounds)} <span className="text-xs font-medium text-muted">lb</span>
        </output>
      </div>
      <div className="relative mb-1.5 mt-3 h-[22px]">
        <input
          id={sliderId}
          type="range"
          min={0}
          max={MAXIMUM_LOAD_POUNDS}
          step={LOAD_STEP_POUNDS}
          value={loadPounds}
          aria-describedby={hintId}
          aria-valuetext={`${formatPounds(loadPounds)} pounds`}
          onChange={(event) => onChange(Number(event.target.value))}
          className="load-range w-full"
        />
        {LOAD_RULE_THRESHOLDS.map((threshold) => (
          <div
            key={threshold}
            aria-hidden="true"
            className="pointer-events-none absolute -top-1 h-[30px] w-px bg-line-strong"
            style={{ left: `${(threshold / MAXIMUM_LOAD_POUNDS) * 100}%` }}
          >
            <span className="absolute left-1/2 top-[30px] -translate-x-1/2 whitespace-nowrap text-[10px] text-muted">
              {threshold / 1000}k
            </span>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {LOAD_PRESETS.map((preset) => (
          <Chip
            key={preset.label}
            isActive={loadPounds === preset.pounds}
            onClick={() => onChange(preset.pounds)}
          >
            {preset.label}
          </Chip>
        ))}
      </div>
      <p
        id={hintId}
        className="mt-3 rounded-lg border border-risk-no-travel/30 bg-risk-no-travel/10 px-2.5 py-2 text-xs leading-relaxed text-muted"
      >
        <strong className="font-semibold text-ink">{loadRules.title}</strong> {loadRules.detail}
      </p>
    </section>
  );
}
