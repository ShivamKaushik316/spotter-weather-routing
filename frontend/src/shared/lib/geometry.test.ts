import { bearingDegrees, findSpanIndex, haversineMiles, PolylineMeasure } from "./geometry";

const NEW_YORK = [-74.006, 40.7128] as const;
const LOS_ANGELES = [-118.2437, 34.0522] as const;

describe("geometry", () => {
  it("measures great-circle distance in miles", () => {
    expect(haversineMiles(NEW_YORK, LOS_ANGELES)).toBeCloseTo(2445.6, -1);
    expect(haversineMiles(NEW_YORK, NEW_YORK)).toBe(0);
  });

  it("computes compass bearing", () => {
    expect(bearingDegrees([0, 0], [1, 0])).toBeCloseTo(90);
    expect(bearingDegrees([0, 0], [0, 1])).toBeCloseTo(0);
  });

  it("finds the span containing a value", () => {
    const values = [0, 10, 20, 30];

    expect(findSpanIndex(values, 0)).toBe(1);
    expect(findSpanIndex(values, 15)).toBe(2);
    expect(findSpanIndex(values, 30)).toBe(3);
    expect(findSpanIndex(values, 99)).toBe(3);
  });

  describe("PolylineMeasure", () => {
    const polyline = new PolylineMeasure([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);

    it("interpolates points by fraction of length", () => {
      const [longitude, latitude] = polyline.pointAtFraction(0.25);

      expect(longitude).toBeCloseTo(0.5);
      expect(latitude).toBeCloseTo(0);
      expect(polyline.pointAtFraction(-1)).toEqual([0, 0]);
      expect(polyline.pointAtFraction(2)).toEqual([2, 0]);
    });

    it("slices a sub-line including interior vertices", () => {
      const slice = polyline.slice(0.25, 0.75);

      expect(slice).toHaveLength(3);
      expect(slice[0]?.[0]).toBeCloseTo(0.5);
      expect(slice[1]).toEqual([1, 0]);
      expect(slice[2]?.[0]).toBeCloseTo(1.5);
    });

    it("rejects polylines with fewer than two points", () => {
      expect(() => new PolylineMeasure([[0, 0]])).toThrow("at least two");
    });
  });
});
