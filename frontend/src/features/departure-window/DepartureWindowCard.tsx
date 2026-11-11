import { useMemo } from "react";
import { DEPARTURE_WINDOW_HOURS, useDepartureWindow, useTripPlan } from "@/entities/trip";
import { useSubmitTrip } from "@/features/trip-form";
import type { DepartureOption } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { formatClock } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";
import { ClockIcon } from "@/shared/ui/icons";
import { Panel } from "@/shared/ui/Panel";
import { Skeleton } from "@/shared/ui/Skeleton";
import { useTripDraftStore } from "@/stores/tripDraftStore";

const MINIMUM_BAR_RATIO = 0.08;

function riskOf(option: DepartureOption): number {
  return option.summary.average_risk_score ?? 0;
}

export function DepartureWindowCard() {
  const { data: plan } = useTripPlan();
  const { data: departureWindow, isFetching, isError } = useDepartureWindow(plan);
  const setDeparture = useTripDraftStore((state) => state.setDeparture);
  const { submit } = useSubmitTrip();

  const optionsByDelay = useMemo(
    () =>
      [...(departureWindow?.options ?? [])].sort(
        (first, second) => first.delay_hours - second.delay_hours,
      ),
    [departureWindow],
  );
  const highestRisk = Math.max(...optionsByDelay.map(riskOf), 0.01);

  if (!plan || isError) return null;

  const recommended = departureWindow?.recommended_option;
  const isAlreadyBest = recommended?.delay_hours === 0;

  const replanAt = (option: DepartureOption) => {
    setDeparture(new Date(option.departure));
    submit();
  };

  return (
    <Panel
      as="section"
      aria-labelledby="departure-window-heading"
      className="departure-window absolute bottom-[140px] right-4 w-[300px] p-3.5"
    >
      <div className="flex items-center justify-between">
        <h2
          id="departure-window-heading"
          className="flex items-center gap-1.5 text-[13px] font-bold"
        >
          <ClockIcon size={14} className="text-accent" /> Best departure
        </h2>
        <span className="text-[11px] text-muted">next {DEPARTURE_WINDOW_HOURS} h</span>
      </div>

      {isFetching && !departureWindow && <Skeleton className="mt-3 h-[112px]" />}

      {departureWindow && recommended && (
        <>
          <div
            className="mb-1.5 mt-3 flex h-16 items-end gap-[5px]"
            role="img"
            aria-label="Average route risk for each departure delay"
          >
            {optionsByDelay.map((option) => (
              <div
                key={option.delay_hours}
                title={`+${option.delay_hours} h · average risk ${riskOf(option).toFixed(2)}`}
                className={cn(
                  "flex-1 rounded-t transition-[height] duration-500 ease-out",
                  option.delay_hours === recommended.delay_hours ? "bg-accent" : "bg-hover",
                )}
                style={{
                  height: `${Math.max(riskOf(option) / highestRisk, MINIMUM_BAR_RATIO) * 100}%`,
                }}
              />
            ))}
          </div>
          <div className="flex gap-[5px] text-[10px] text-muted" aria-hidden="true">
            {optionsByDelay.map((option) => (
              <span key={option.delay_hours} className="flex-1 text-center">
                +{option.delay_hours}h
              </span>
            ))}
          </div>
          <p className="my-2.5 text-xs leading-relaxed text-muted">
            {isAlreadyBest ? (
              <>
                <strong className="text-ink">Leaving now is already the safest</strong> option in
                the next {DEPARTURE_WINDOW_HOURS} hours.
              </>
            ) : (
              <>
                Leaving <strong className="text-ink">{recommended.delay_hours} h later</strong>:{" "}
                <span className="font-mono">{recommended.change_from_baseline}</span>.
              </>
            )}
          </p>
          {!isAlreadyBest && (
            <Button
              variant="secondary"
              className="w-full py-2"
              onClick={() => replanAt(recommended)}
            >
              Re-plan for {formatClock(new Date(recommended.departure))}
            </Button>
          )}
        </>
      )}
    </Panel>
  );
}
