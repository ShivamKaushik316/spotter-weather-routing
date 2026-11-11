import { HEAT_WEIGHT_EXPONENT, heatmapCrossfade, hourlyHeatWeight } from "./heatmapExpression";

describe("hourlyHeatWeight", () => {
  it("emphasises strong weather over calm weather for one forecast hour", () => {
    expect(hourlyHeatWeight(7)).toEqual([
      "^",
      ["coalesce", ["get", "h7"], 0],
      HEAT_WEIGHT_EXPONENT,
    ]);
  });
});

describe("heatmapCrossfade", () => {
  it("blends the two forecast hours around a fractional slider position", () => {
    expect(heatmapCrossfade(3.25)).toEqual({
      evenHour: 4,
      oddHour: 3,
      evenOpacityRatio: 0.25,
      oddOpacityRatio: 0.75,
    });
  });

  it("shows a single hour on whole-hour positions", () => {
    expect(heatmapCrossfade(6)).toEqual({
      evenHour: 6,
      oddHour: 7,
      evenOpacityRatio: 1,
      oddOpacityRatio: 0,
    });
  });

  it("only re-targets the layer that is fully transparent when crossing an hour", () => {
    const justBefore = heatmapCrossfade(4.999);
    const justAfter = heatmapCrossfade(5);

    expect(justAfter.oddHour).toBe(justBefore.oddHour);
    expect(justAfter.evenHour).not.toBe(justBefore.evenHour);
    expect(justBefore.evenOpacityRatio).toBeCloseTo(0.001);
    expect(justAfter.evenOpacityRatio).toBe(0);
    expect(justAfter.oddOpacityRatio).toBe(1);
  });

  it("clamps to the forecast range", () => {
    expect(heatmapCrossfade(60, 48)).toEqual({
      evenHour: 48,
      oddHour: 47,
      evenOpacityRatio: 1,
      oddOpacityRatio: 0,
    });
    expect(heatmapCrossfade(-2, 48)).toEqual(heatmapCrossfade(0, 48));
  });
});
