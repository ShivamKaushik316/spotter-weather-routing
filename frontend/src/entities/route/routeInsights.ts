import { milesAtLevel } from "@/entities/risk";
import type { PlannedRoute, TripPlan } from "@/shared/api/types";
import { formatMiles } from "@/shared/lib/format";

export function routeHeadline(route: PlannedRoute, plan: TripPlan): string {
  if (route.route_id === plan.recommended_route_id) return plan.recommendation_reason;
  const { miles_by_level: milesByLevel, unknown_miles: unknownMiles } = route.summary;
  const noTravelMiles = milesAtLevel(milesByLevel, "No Travel");
  if (noTravelMiles > 0)
    return `Crosses ${formatMiles(noTravelMiles, 1)} mi of No Travel conditions.`;
  const severeMiles = milesAtLevel(milesByLevel, "Severe");
  if (severeMiles > 0) return `${formatMiles(severeMiles, 1)} mi of Severe conditions.`;
  const highMiles = milesAtLevel(milesByLevel, "High");
  if (highMiles > 0) return `${formatMiles(highMiles, 1)} mi of High risk conditions.`;
  if (unknownMiles > 0) return `Forecast unavailable for ${formatMiles(unknownMiles, 1)} mi.`;
  return "Low to moderate conditions along the whole route.";
}

export function severeOrWorseMiles(route: PlannedRoute): number {
  return (
    milesAtLevel(route.summary.miles_by_level, "Severe") +
    milesAtLevel(route.summary.miles_by_level, "No Travel")
  );
}

export function hasNoTravelSegment(route: PlannedRoute): boolean {
  return milesAtLevel(route.summary.miles_by_level, "No Travel") > 0;
}

export function findRoute(
  plan: TripPlan | undefined,
  routeId: string | null,
): PlannedRoute | undefined {
  if (!plan || routeId === null) return undefined;
  return plan.routes.find((route) => route.route_id === routeId);
}
