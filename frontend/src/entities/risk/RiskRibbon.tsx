import type { Checkpoint } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { riskColor } from "./riskLevels";

interface RiskRibbonProps {
  checkpoints: readonly Checkpoint[];
  totalMiles: number;
  className?: string;
}

export function RiskRibbon({ checkpoints, totalMiles, className }: RiskRibbonProps) {
  return (
    <div
      role="img"
      aria-label="Risk level along the route from origin to destination"
      className={cn("flex h-[7px] gap-px overflow-hidden rounded", className)}
    >
      {checkpoints.map((checkpoint) => (
        <i
          key={checkpoint.sequence}
          style={{
            flexGrow: totalMiles > 0 ? checkpoint.represented_miles : 1,
            backgroundColor: riskColor(checkpoint.risk_level),
          }}
        />
      ))}
    </div>
  );
}
