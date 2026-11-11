import type { PlannedRoute } from "@/shared/api/types";
import { RouteTimeline } from "./routeTimeline";

const DEPARTURE = Date.parse("2026-11-12T06:00:00Z");
const HOUR = 3_600_000;

function checkpoint(sequence: number, distance: number, hoursAfterDeparture: number) {
  return {
    sequence,
    latitude: 0,
    longitude: distance / 69.17,
    distance_from_origin_miles: distance,
    represented_miles: 0,
    estimated_arrival: new Date(DEPARTURE + hoursAfterDeparture * HOUR).toISOString(),
    weather: null,
    risk_level: null,
    risk_score: null,
    risk_reasons: [],
  };
}

const route = {
  route_id: "A",
  provider: "test",
  travel_profile: "truck",
  geometry: {
    type: "LineString",
    coordinates: [
      [0, 0],
      [100 / 69.17, 0],
    ],
  },
  summary: {
    distance_miles: 100,
    duration_seconds: 3 * 3600,
    miles_by_level: {},
    unknown_miles: 0,
    average_risk_score: null,
    highest_risk_level: null,
  },
  checkpoints: [checkpoint(0, 0, 0), checkpoint(1, 50, 2), checkpoint(2, 100, 3)],
} satisfies PlannedRoute;

describe("RouteTimeline", () => {
  const timeline = new RouteTimeline(route);

  it("stays at the origin before departure and at the destination after arrival", () => {
    expect(timeline.progressAt(DEPARTURE - HOUR)).toBe(0);
    expect(timeline.progressAt(DEPARTURE + 5 * HOUR)).toBe(1);
    expect(timeline.positionAt(DEPARTURE + 5 * HOUR).hasArrived).toBe(true);
  });

  it("follows checkpoint ETAs rather than average speed", () => {
    expect(timeline.progressAt(DEPARTURE + HOUR)).toBeCloseTo(0.25);
    expect(timeline.progressAt(DEPARTURE + 2.5 * HOUR)).toBeCloseTo(0.75);
  });

  it("returns a coordinate on the route geometry with a heading", () => {
    const position = timeline.positionAt(DEPARTURE + 2 * HOUR);

    expect(position.coordinate[0]).toBeCloseTo(50 / 69.17, 3);
    expect(position.bearing).toBeCloseTo(90);
    expect(position.routeId).toBe("A");
  });
});
