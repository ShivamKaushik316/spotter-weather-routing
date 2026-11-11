import { heatTimelineGradient, RISK_LEVELS, RiskGlyph } from "@/entities/risk";

const LEGEND_RAMP = heatTimelineGradient([0, 0.25, 0.5, 0.75, 1]);

export function Legend() {
  return (
    <div className="flex flex-none flex-col gap-2 border-l border-line pl-[18px] max-[1100px]:hidden">
      <ul className="grid grid-cols-3 gap-x-3.5 gap-y-1.5" aria-label="Route risk levels">
        {RISK_LEVELS.map((level) => (
          <li key={level.key} className="flex items-center gap-1.5 text-[11px] text-muted">
            <RiskGlyph level={level.key} color={level.color} />
            {level.key}
          </li>
        ))}
      </ul>
      <div>
        <div
          aria-hidden="true"
          className="h-1.5 rounded-full"
          style={{ backgroundImage: LEGEND_RAMP }}
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>heatmap &amp; timeline: calm</span>
          <span>extreme</span>
        </div>
      </div>
    </div>
  );
}
