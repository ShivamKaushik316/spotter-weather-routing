import type { CSSProperties } from "react";
import { RiskRibbon, riskDefinition } from "@/entities/risk";
import {
  describeRouteSource,
  hasNoTravelSegment,
  routeHeadline,
  severeOrWorseMiles,
} from "@/entities/route";
import type { PlannedRoute, TripPlan } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { formatDuration, formatMiles, formatRiskScore } from "@/shared/lib/format";
import { InfoIcon } from "@/shared/ui/icons";

interface RouteStripProps {
  route: PlannedRoute;
  plan: TripPlan;
  rank: number;
  isSelected: boolean;
  onSelect: (routeId: string) => void;
  onHover: (routeId: string | null) => void;
}

export function RouteStrip({ route, plan, rank, isSelected, onSelect, onHover }: RouteStripProps) {
  const isRecommended = route.route_id === plan.recommended_route_id;
  const isBlocked = hasNoTravelSegment(route);
  const severeMiles = severeOrWorseMiles(route);
  const routeSource = describeRouteSource(route);
  const accentColor = isRecommended
    ? "var(--color-accent)"
    : riskDefinition(route.summary.highest_risk_level).cssColor;

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={`Route ${route.route_id}, rank ${rank}${isRecommended ? ", recommended" : ""}`}
      onClick={() => onSelect(route.route_id)}
      onMouseEnter={() => onHover(route.route_id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(route.route_id)}
      onBlur={() => onHover(null)}
      className={cn(
        "route-strip relative w-full rounded-xl border bg-raised py-3 pl-4 pr-3 text-left transition duration-150 hover:bg-hover",
        isSelected ? "border-accent" : "border-line",
        isRecommended && "shadow-glow",
      )}
      style={{ "--strip-color": accentColor } as CSSProperties}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid size-[26px] place-items-center rounded-[7px] text-[13px] font-bold",
            isRecommended ? "bg-accent text-accent-ink" : "bg-hover",
          )}
        >
          {route.route_id}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold">Route {route.route_id}</span>
          <span className="block truncate text-[11px] text-muted" title={routeSource.explanation}>
            {routeSource.label}
          </span>
        </span>
        {isRecommended && (
          <span className="ml-auto rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
            Recommended
          </span>
        )}
        {!isRecommended && isBlocked && (
          <span className="ml-auto rounded-md bg-risk-no-travel/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-risk-no-travel">
            No Travel
          </span>
        )}
      </div>

      <dl className="mt-2.5 grid grid-cols-4 gap-1.5">
        <RouteStat label="miles" value={formatMiles(route.summary.distance_miles)} />
        <RouteStat label="drive" value={formatDuration(route.summary.duration_seconds)} />
        <RouteStat
          label="sev+ mi"
          value={formatMiles(severeMiles, severeMiles > 0 ? 1 : 0)}
          isAlarming={severeMiles > 0}
        />
        <RouteStat label="avg risk" value={formatRiskScore(route.summary.average_risk_score)} />
      </dl>

      <RiskRibbon
        checkpoints={route.checkpoints}
        totalMiles={route.summary.distance_miles}
        className="mt-2.5"
      />

      <p className="mt-2.5 flex gap-1.5 text-xs leading-snug text-muted">
        <InfoIcon size={13} className="mt-px flex-none text-accent" />
        <span>{routeHeadline(route, plan)}</span>
      </p>
    </button>
  );
}

function RouteStat({
  label,
  value,
  isAlarming = false,
}: {
  label: string;
  value: string;
  isAlarming?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-[10px] uppercase tracking-wide text-muted">{label}</dt>
      <dd
        className={cn(
          "font-mono text-[13px] font-semibold tabular-nums",
          isAlarming && "text-risk-severe",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
