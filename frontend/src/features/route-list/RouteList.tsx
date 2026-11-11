import { useEffect, useRef } from "react";
import { useTripPlan } from "@/entities/trip";
import { ApiError } from "@/shared/api/client";
import { Skeleton } from "@/shared/ui/Skeleton";
import { SectionLabel } from "@/shared/ui/SectionLabel";
import { AlertIcon, TrendIcon } from "@/shared/ui/icons";
import { useSelectionStore } from "@/stores/selectionStore";
import { RouteStrip } from "./RouteStrip";

const SKELETON_COUNT = 3;

export function RouteList() {
  const { data: plan, error, isFetching, isPending, refetch, fetchStatus } = useTripPlan();
  const selectedRouteId = useSelectionStore((state) => state.selectedRouteId);
  const selectRoute = useSelectionStore((state) => state.selectRoute);
  const hoverRoute = useSelectionStore((state) => state.hoverRoute);
  const isIdle = isPending && fetchStatus === "idle";
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!plan && !isFetching) return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [plan, isFetching]);

  return (
    <section ref={sectionRef} aria-labelledby="routes-heading" aria-busy={isFetching}>
      <SectionLabel
        id="routes-heading"
        trailing={<span className="normal-case tracking-normal text-muted">ranked by risk</span>}
      >
        Routes
      </SectionLabel>

      <div aria-live="polite" className="sr-only">
        {plan &&
          `${plan.routes.length} routes planned. Route ${plan.recommended_route_id} recommended.`}
      </div>

      {isIdle && <EmptyState />}

      {isFetching && !plan && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <Skeleton key={index} className="h-[132px] rounded-xl" />
          ))}
        </div>
      )}

      {error && !isFetching && <PlanError error={error} onRetry={() => void refetch()} />}

      {plan && (
        <ol className="flex flex-col gap-2">
          {plan.routes.map((route, index) => (
            <li key={route.route_id}>
              <RouteStrip
                route={route}
                plan={plan}
                rank={index + 1}
                isSelected={route.route_id === selectedRouteId}
                onSelect={selectRoute}
                onHover={hoverRoute}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-center">
      <div className="mx-auto mb-2 grid size-9 place-items-center rounded-full bg-accent-soft text-accent">
        <TrendIcon size={16} />
      </div>
      <p className="text-sm font-semibold">No trip planned yet</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Pick an origin and destination, or try a sample trip above. We compare three routes and
        sample the forecast at every checkpoint ETA.
      </p>
    </div>
  );
}

function PlanError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const requestId = error instanceof ApiError ? error.requestId : null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-risk-severe/40 bg-risk-severe/10 p-3.5 text-sm"
    >
      <div className="flex items-center gap-2 font-semibold text-risk-severe">
        <AlertIcon size={15} /> Could not plan this trip
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{error.message}</p>
      {requestId && <p className="mt-1 font-mono text-[10px] text-muted">request {requestId}</p>}
      <button
        type="button"
        onClick={onRetry}
        className="mt-2.5 text-xs font-semibold text-accent hover:underline"
      >
        Try again
      </button>
    </div>
  );
}
