import { useCorridorHeatmap, useTripPlan } from "@/entities/trip";

export function MapStatusPill() {
  const { data: plan, isFetching: isPlanning } = useTripPlan();
  const { isFetching: isLoadingHeatmap } = useCorridorHeatmap(plan);
  const message = isPlanning
    ? "Routing and sampling weather at every checkpoint…"
    : isLoadingHeatmap
      ? "Loading 48-hour corridor heatmap…"
      : null;

  if (!message) return null;

  return (
    <div
      role="status"
      className="glass status-pill absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium"
    >
      <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-accent" />
      {message}
    </div>
  );
}
