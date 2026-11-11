import type { CorridorHeatmap } from "@/shared/api/types";

interface HeatColorStop {
  value: number;
  rgba: readonly [number, number, number, number];
}

const CALM_STOP: HeatColorStop = { value: 0, rgba: [148, 163, 184, 0.18] };

const HEAT_COLOR_STOPS: readonly HeatColorStop[] = [
  CALM_STOP,
  { value: 0.25, rgba: [234, 179, 8, 0.6] },
  { value: 0.5, rgba: [249, 115, 22, 0.78] },
  { value: 0.75, rgba: [239, 68, 68, 0.88] },
  { value: 1, rgba: [255, 43, 214, 0.92] },
];

const CORRIDOR_PERCENTILE = 0.9;

export function heatColor(value: number): string {
  const boundedValue = Math.min(Math.max(value, 0), 1);
  const upperIndex = Math.max(
    1,
    HEAT_COLOR_STOPS.findIndex((stop) => stop.value >= boundedValue),
  );
  const lower = HEAT_COLOR_STOPS[upperIndex - 1] ?? CALM_STOP;
  const upper = HEAT_COLOR_STOPS[upperIndex] ?? lower;
  const span = upper.value - lower.value;
  const progress = span === 0 ? 0 : (boundedValue - lower.value) / span;
  const [red, green, blue, alpha] = lower.rgba.map(
    (channel, index) => channel + ((upper.rgba[index] ?? channel) - channel) * progress,
  ) as [number, number, number, number];
  return `rgba(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)}, ${alpha.toFixed(2)})`;
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] ?? 0;
}

export function corridorHeatByHour(heatmap: CorridorHeatmap): number[] {
  return heatmap.hours.map((_, hourOffset) =>
    percentile(
      heatmap.features
        .map((feature) => feature.properties[`h${hourOffset}`])
        .filter((value): value is number => typeof value === "number"),
      CORRIDOR_PERCENTILE,
    ),
  );
}

export function heatTimelineGradient(hourlyHeat: readonly number[]): string {
  if (hourlyHeat.length < 2) return heatColor(hourlyHeat[0] ?? 0);
  const lastIndex = hourlyHeat.length - 1;
  const stops = hourlyHeat.map(
    (value, index) => `${heatColor(value)} ${((index / lastIndex) * 100).toFixed(2)}%`,
  );
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
