import { riskColor } from "@/entities/risk";
import { tripPlan } from "@/test/server";
import {
  buildCheckpointCollection,
  buildRouteLineCollection,
  buildRouteSegmentCollection,
  collectPlanCoordinates,
} from "./routeFeatures";

describe("routeFeatures", () => {
  it("builds one line per route and flags the recommended one", () => {
    const lines = buildRouteLineCollection(tripPlan);

    expect(lines.features).toHaveLength(tripPlan.routes.length);
    expect(lines.features.filter((feature) => feature.properties.isRecommended)).toHaveLength(1);
  });

  it("builds one risk-coloured segment per checkpoint", () => {
    const segments = buildRouteSegmentCollection(tripPlan);
    const firstRoute = tripPlan.routes[0]!;
    const firstRouteSegments = segments.features.filter(
      (feature) => feature.properties.routeId === firstRoute.route_id,
    );

    expect(firstRouteSegments).toHaveLength(firstRoute.checkpoints.length);
    expect(firstRouteSegments.map((feature) => feature.properties.color)).toEqual(
      firstRoute.checkpoints.map((checkpoint) => riskColor(checkpoint.risk_level)),
    );
    expect(firstRouteSegments.every((feature) => feature.geometry.coordinates.length >= 2)).toBe(
      true,
    );
  });

  it("places checkpoints at their coordinates", () => {
    const checkpoints = buildCheckpointCollection(tripPlan);
    const firstCheckpoint = tripPlan.routes[0]!.checkpoints[0]!;

    expect(checkpoints.features[0]?.geometry.coordinates).toEqual([
      firstCheckpoint.longitude,
      firstCheckpoint.latitude,
    ]);
    expect(checkpoints.features[0]?.properties.sequence).toBe(0);
  });

  it("collects every route coordinate for map fitting", () => {
    const expectedCount = tripPlan.routes.reduce(
      (total, route) => total + route.geometry.coordinates.length,
      0,
    );

    expect(collectPlanCoordinates(tripPlan)).toHaveLength(expectedCount);
  });
});
