import type { TripRequest } from "@/shared/api/types";

export const tripQueryKeys = {
  plan: (request: TripRequest | null) => ["trip-plan", request] as const,
  heatmap: (request: TripRequest | null) => ["corridor-heatmap", request] as const,
  departureWindow: (request: TripRequest | null, windowHours: number) =>
    ["departure-window", request, windowHours] as const,
  places: (query: string) => ["places", query] as const,
};
