import type { CorridorHeatmap } from "@/shared/api/types";
import { tripPlan } from "@/test/server";
import { corridorHeatByHour, heatColor, heatTimelineGradient } from "./heatScale";

function heatmapWith(valuesByCell: (number | null)[][]): CorridorHeatmap {
  const hourCount = valuesByCell[0]?.length ?? 0;
  return {
    type: "FeatureCollection",
    hours: Array.from({ length: hourCount }, (_, index) => `2026-11-12T0${index}:00:00Z`),
    features: valuesByCell.map((values, cellIndex) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [cellIndex, 0] },
      properties: Object.fromEntries(values.map((value, hour) => [`h${hour}`, value])),
    })),
    meta: tripPlan.meta,
  };
}

describe("heatScale", () => {
  it("maps calm to neutral grey and extreme to magenta", () => {
    expect(heatColor(0)).toBe("rgba(148, 163, 184, 0.18)");
    expect(heatColor(1)).toBe("rgba(255, 43, 214, 0.92)");
    expect(heatColor(0.75)).toBe("rgba(239, 68, 68, 0.88)");
  });

  it("clamps values outside 0–1", () => {
    expect(heatColor(-1)).toBe(heatColor(0));
    expect(heatColor(3)).toBe(heatColor(1));
  });

  it("summarises the corridor per hour while ignoring unknown cells", () => {
    const heatmap = heatmapWith([
      [0.1, 0.9],
      [0.2, null],
      [0.3, 0.5],
    ]);

    expect(corridorHeatByHour(heatmap)).toEqual([0.3, 0.9]);
  });

  it("builds a left-to-right gradient with one stop per hour", () => {
    const gradient = heatTimelineGradient([0, 1]);

    expect(gradient).toBe(`linear-gradient(90deg, ${heatColor(0)} 0.00%, ${heatColor(1)} 100.00%)`);
  });
});
