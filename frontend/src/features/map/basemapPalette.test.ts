import type { Map as MapLibreMap } from "maplibre-gl";
import { describe, expect, it, vi } from "vitest";
import { applyBasemapPalette } from "./basemapPalette";

function fakeMap(existingLayerIds: string[]) {
  const setPaintProperty = vi.fn();
  const map = {
    getLayer: (layerId: string) =>
      existingLayerIds.includes(layerId) ? { id: layerId } : undefined,
    setPaintProperty,
  } as unknown as MapLibreMap;
  return { map, setPaintProperty };
}

describe("applyBasemapPalette", () => {
  it("recolours land and water of the dark streets style", () => {
    const { map, setPaintProperty } = fakeMap(["background", "water"]);

    applyBasemapPalette(map, "streets-dark");

    expect(setPaintProperty).toHaveBeenCalledWith("background", "background-color", "#141d33");
    expect(setPaintProperty).toHaveBeenCalledWith("water", "fill-color", "#090f1d");
    expect(setPaintProperty).toHaveBeenCalledTimes(2);
  });

  it("leaves styles without a palette untouched", () => {
    const { map, setPaintProperty } = fakeMap(["background", "water"]);

    applyBasemapPalette(map, "satellite");

    expect(setPaintProperty).not.toHaveBeenCalled();
  });
});
