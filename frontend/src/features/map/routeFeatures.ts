import type { FeatureCollection, LineString, Point, Position } from "geojson";
import { riskColor } from "@/entities/risk";
import type { PlannedRoute, TripPlan } from "@/shared/api/types";
import { PolylineMeasure, toLngLat, type LngLat } from "@/shared/lib/geometry";

export interface RouteLineProperties {
  routeId: string;
  isRecommended: boolean;
}

export interface RouteSegmentProperties extends RouteLineProperties {
  color: string;
}

export interface CheckpointProperties extends RouteSegmentProperties {
  sequence: number;
}

const toPosition = (coordinate: LngLat): Position => [coordinate[0], coordinate[1]];

export function buildRouteLineCollection(
  plan: TripPlan,
): FeatureCollection<LineString, RouteLineProperties> {
  return {
    type: "FeatureCollection",
    features: plan.routes.map((route) => ({
      type: "Feature",
      properties: {
        routeId: route.route_id,
        isRecommended: route.route_id === plan.recommended_route_id,
      },
      geometry: { type: "LineString", coordinates: route.geometry.coordinates },
    })),
  };
}

function checkpointSpanFractions(route: PlannedRoute): [number, number][] {
  const totalMiles = route.summary.distance_miles;
  const distances = route.checkpoints.map((checkpoint) => checkpoint.distance_from_origin_miles);
  return distances.map((distance, index) => {
    const previousDistance = distances[index - 1];
    const nextDistance = distances[index + 1];
    const spanStart = previousDistance === undefined ? 0 : (previousDistance + distance) / 2;
    const spanEnd = nextDistance === undefined ? totalMiles : (distance + nextDistance) / 2;
    return totalMiles > 0 ? [spanStart / totalMiles, spanEnd / totalMiles] : [0, 1];
  });
}

export function buildRouteSegmentCollection(
  plan: TripPlan,
): FeatureCollection<LineString, RouteSegmentProperties> {
  const features = plan.routes.flatMap((route) => {
    if (route.geometry.coordinates.length < 2) return [];
    const polyline = new PolylineMeasure(route.geometry.coordinates.map(toLngLat));
    const isRecommended = route.route_id === plan.recommended_route_id;
    return checkpointSpanFractions(route).flatMap(([spanStart, spanEnd], index) => {
      const checkpoint = route.checkpoints[index];
      if (!checkpoint || spanEnd <= spanStart) return [];
      return [
        {
          type: "Feature" as const,
          properties: {
            routeId: route.route_id,
            isRecommended,
            color: riskColor(checkpoint.risk_level),
          },
          geometry: {
            type: "LineString" as const,
            coordinates: polyline.slice(spanStart, spanEnd).map(toPosition),
          },
        },
      ];
    });
  });
  return { type: "FeatureCollection", features };
}

export function buildCheckpointCollection(
  plan: TripPlan,
): FeatureCollection<Point, CheckpointProperties> {
  return {
    type: "FeatureCollection",
    features: plan.routes.flatMap((route) =>
      route.checkpoints.map((checkpoint) => ({
        type: "Feature" as const,
        properties: {
          routeId: route.route_id,
          sequence: checkpoint.sequence,
          isRecommended: route.route_id === plan.recommended_route_id,
          color: riskColor(checkpoint.risk_level),
        },
        geometry: {
          type: "Point" as const,
          coordinates: [checkpoint.longitude, checkpoint.latitude],
        },
      })),
    ),
  };
}

export function collectPlanCoordinates(plan: TripPlan): LngLat[] {
  return plan.routes.flatMap((route) => route.geometry.coordinates.map(toLngLat));
}
