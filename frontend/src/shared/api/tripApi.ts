import { requestJson } from "./client";
import type {
  CorridorHeatmap,
  DepartureWindowPlan,
  DepartureWindowRequest,
  GeocodeResults,
  HeatmapRequest,
  TripPlan,
  TripRequest,
} from "./types";

export const tripApi = {
  planTrip: (request: TripRequest, signal?: AbortSignal) =>
    requestJson<TripPlan>("/api/trips/plan", { method: "POST", body: request, signal }),

  findDepartureWindow: (request: DepartureWindowRequest, signal?: AbortSignal) =>
    requestJson<DepartureWindowPlan>("/api/trips/departure-window", {
      method: "POST",
      body: request,
      signal,
    }),

  fetchCorridorHeatmap: (request: HeatmapRequest, signal?: AbortSignal) =>
    requestJson<CorridorHeatmap>("/api/trips/heatmap", { method: "POST", body: request, signal }),

  searchPlaces: (query: string, limit: number, signal?: AbortSignal) =>
    requestJson<GeocodeResults>("/api/geocode", { query: { query, limit }, signal }),
};
