import type { DataDrivenPropertyValueSpecification } from "maplibre-gl";
import { FORECAST_HOURS } from "@/stores/timelineStore";

export const HEAT_WEIGHT_EXPONENT = 1.15;

export function hourlyHeatWeight(hour: number): DataDrivenPropertyValueSpecification<number> {
  return ["^", ["coalesce", ["get", `h${hour}`], 0], HEAT_WEIGHT_EXPONENT];
}

export interface HeatmapCrossfade {
  evenHour: number;
  oddHour: number;
  evenOpacityRatio: number;
  oddOpacityRatio: number;
}

export function heatmapCrossfade(
  hour: number,
  maximumHour: number = FORECAST_HOURS,
): HeatmapCrossfade {
  const boundedHour = Math.min(Math.max(hour, 0), maximumHour);
  const lowerHour = Math.min(Math.floor(boundedHour), maximumHour - 1);
  const upperHour = lowerHour + 1;
  const blendWeight = boundedHour - lowerHour;
  const lowerIsEven = lowerHour % 2 === 0;
  return {
    evenHour: lowerIsEven ? lowerHour : upperHour,
    oddHour: lowerIsEven ? upperHour : lowerHour,
    evenOpacityRatio: lowerIsEven ? 1 - blendWeight : blendWeight,
    oddOpacityRatio: lowerIsEven ? blendWeight : 1 - blendWeight,
  };
}
