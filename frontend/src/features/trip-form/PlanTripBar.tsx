import { useMemo } from "react";
import { useTripPlan } from "@/entities/trip";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/Button";
import { ArrowRightIcon } from "@/shared/ui/icons";
import { useTripDraftStore } from "@/stores/tripDraftStore";
import { describePlanAction } from "./planActionState";
import { TRIP_FORM_ID } from "./tripFormId";

export function PlanTripBar() {
  const { isFetching } = useTripPlan();
  const origin = useTripDraftStore((state) => state.origin);
  const destination = useTripDraftStore((state) => state.destination);
  const departure = useTripDraftStore((state) => state.departure);
  const loadPounds = useTripDraftStore((state) => state.loadPounds);
  const intervalMiles = useTripDraftStore((state) => state.intervalMiles);
  const submittedRequest = useTripDraftStore((state) => state.submittedTrip?.request ?? null);

  const action = useMemo(
    () =>
      describePlanAction(
        { origin, destination, departure, loadPounds, intervalMiles },
        submittedRequest,
      ),
    [origin, destination, departure, loadPounds, intervalMiles, submittedRequest],
  );
  const isUpToDate = action.kind === "up-to-date";

  return (
    <div className="border-t border-line bg-panel px-[18px] pb-[18px] pt-3">
      <p
        className={cn(
          "mb-2 flex items-center gap-1.5 truncate text-xs",
          action.kind === "inputs-changed" ? "font-medium text-ink" : "text-muted",
        )}
        aria-live="polite"
      >
        {action.kind === "inputs-changed" && (
          <span aria-hidden="true" className="size-1.5 flex-none rounded-full bg-accent" />
        )}
        <span className="truncate">
          {action.kind === "inputs-changed" ? `Trip changed · ${action.summary}` : action.summary}
        </span>
      </p>
      <Button
        type="submit"
        form={TRIP_FORM_ID}
        variant={isUpToDate ? "secondary" : "primary"}
        isLoading={isFetching}
        className="w-full py-3"
      >
        <ArrowRightIcon size={16} />
        {isFetching ? "Checking weather on every route…" : action.label}
      </Button>
    </div>
  );
}
