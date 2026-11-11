import type { RiskLevelLabel } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { RiskGlyph } from "./RiskGlyph";
import { riskDefinition } from "./riskLevels";

interface RiskBadgeProps {
  level: RiskLevelLabel | null;
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const definition = riskDefinition(level);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        className,
      )}
      style={{ color: definition.cssColor, backgroundColor: `${definition.color}22` }}
    >
      <RiskGlyph level={definition.key} color={definition.color} />
      {definition.key}
    </span>
  );
}
