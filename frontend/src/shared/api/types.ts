import type { components } from "./schema";

type Schemas = components["schemas"];

export type TripRequest = Schemas["TripRequest"];
export type TripPlan = Schemas["TripPlanResponse"];
export type PlannedRoute = Schemas["Route"];
export type RouteSummary = Schemas["RouteSummary"];
export type Checkpoint = Schemas["Checkpoint"];
export type WeatherConditions = Schemas["WeatherConditions"];
export type RiskLevelLabel = Schemas["RiskLevelLabel"];
export type SamplingInterval = Schemas["IntervalMilesEnum"];
export type DepartureWindowRequest = Schemas["DepartureWindowRequest"];
export type DepartureWindowPlan = Schemas["DepartureWindowPlanResponse"];
export type DepartureOption = Schemas["DepartureOption"];
export type Place = Schemas["Place"];
export type GeocodeResults = Schemas["GeocodeResultsResponse"];
export type HeatmapRequest = Schemas["HeatmapRequest"];
export type ResponseMeta = Schemas["ResponseMeta"];

export interface HeatmapFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, number | null>;
}

export interface CorridorHeatmap {
  type: "FeatureCollection";
  hours: string[];
  features: HeatmapFeature[];
  meta: ResponseMeta;
}

export const SAMPLING_INTERVALS: readonly SamplingInterval[] = [10, 25, 50];
