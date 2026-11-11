import { tripPlan } from "@/test/server";
import { describeRouteSource } from "./routeSource";

const [firstRoute] = tripPlan.routes;

describe("describeRouteSource", () => {
  it("labels truck-profile routes", () => {
    const source = describeRouteSource({
      ...firstRoute!,
      provider: "openrouteservice",
      travel_profile: "truck",
    });

    expect(source.label).toBe("Truck route · OpenRouteService");
  });

  it("explains that car routes use truck-adjusted times", () => {
    const source = describeRouteSource({
      ...firstRoute!,
      provider: "osrm",
      travel_profile: "car_adjusted_for_truck",
    });

    expect(source.label).toBe("Car route, truck-adjusted time · OSRM");
    expect(source.explanation).toMatch(/scaled to typical truck speeds/);
  });

  it("falls back to the raw provider name", () => {
    expect(
      describeRouteSource({ ...firstRoute!, provider: "here", travel_profile: "truck" }).label,
    ).toBe("Truck route · here");
  });
});
