import { skipToken, useQuery } from "@tanstack/react-query";
import { tripApi } from "@/shared/api/tripApi";
import type { TripPlan } from "@/shared/api/types";
import { useTripDraftStore } from "@/stores/tripDraftStore";
import { tripQueryKeys } from "./queryKeys";

export const DEPARTURE_WINDOW_HOURS = 6;

export function useSubmittedTripRequest() {
  return useTripDraftStore((state) => state.submittedTrip?.request ?? null);
}

export function useTripPlan() {
  const request = useSubmittedTripRequest();
  return useQuery({
    queryKey: tripQueryKeys.plan(request),
    queryFn: request ? ({ signal }) => tripApi.planTrip(request, signal) : skipToken,
  });
}

export function useCorridorHeatmap(plan: TripPlan | undefined) {
  const request = useSubmittedTripRequest();
  return useQuery({
    queryKey: tripQueryKeys.heatmap(request),
    queryFn:
      plan && request
        ? ({ signal }) =>
            tripApi.fetchCorridorHeatmap(
              {
                routes: plan.routes.map((route) => route.geometry.coordinates),
                departure: plan.departure,
                load_pounds: plan.load_pounds,
              },
              signal,
            )
        : skipToken,
  });
}

export function useDepartureWindow(plan: TripPlan | undefined) {
  const request = useSubmittedTripRequest();
  return useQuery({
    queryKey: tripQueryKeys.departureWindow(request, DEPARTURE_WINDOW_HOURS),
    queryFn:
      plan && request
        ? ({ signal }) =>
            tripApi.findDepartureWindow(
              {
                ...request,
                window_hours: DEPARTURE_WINDOW_HOURS,
                option_limit: DEPARTURE_WINDOW_HOURS + 1,
              },
              signal,
            )
        : skipToken,
  });
}
