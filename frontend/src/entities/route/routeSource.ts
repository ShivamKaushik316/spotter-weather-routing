import type { PlannedRoute } from "@/shared/api/types";

export interface RouteSource {
  label: string;
  explanation: string;
}

const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  openrouteservice: "OpenRouteService",
  osrm: "OSRM",
  detour: "detour via OSRM",
  stub: "simulated data",
};

export function describeRouteSource(route: PlannedRoute): RouteSource {
  const providerName = PROVIDER_NAMES[route.provider] ?? route.provider;
  if (route.travel_profile === "truck") {
    return {
      label: `Truck route · ${providerName}`,
      explanation: "Routed with a heavy-goods-vehicle profile; times are truck driving times.",
    };
  }
  return {
    label: `Car route, truck-adjusted time · ${providerName}`,
    explanation:
      "Routed with a car profile; driving times are scaled to typical truck speeds so all routes compare fairly.",
  };
}
