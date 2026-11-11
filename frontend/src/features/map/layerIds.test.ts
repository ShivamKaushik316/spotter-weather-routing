import type { Map as MaplibreMap } from "maplibre-gl";
import { existingLayerIds, LAYER_IDS, resolveBeforeLayerId } from "./layerIds";

function fakeMap(
  existingLayers: string[],
  basemapLayers: { id: string; type: string }[],
): MaplibreMap {
  return {
    getLayer: (layerId: string) => (existingLayers.includes(layerId) ? { id: layerId } : undefined),
    getStyle: () => ({ layers: basemapLayers }),
  } as unknown as MaplibreMap;
}

describe("layer ordering", () => {
  const basemap = [
    { id: "water", type: "fill" },
    { id: "place-labels", type: "symbol" },
  ];

  it("keeps both heatmap layers under basemap labels", () => {
    const map = fakeMap([], basemap);

    expect(resolveBeforeLayerId(map, LAYER_IDS.corridorHeatEvenHour)).toBe("place-labels");
    expect(resolveBeforeLayerId(map, LAYER_IDS.corridorHeatOddHour)).toBe("place-labels");
  });

  it("keeps the heatmap under satellite labels", () => {
    const satellite = [
      { id: "satellite-imagery", type: "raster" },
      { id: "satellite-labels", type: "raster" },
    ];

    expect(resolveBeforeLayerId(fakeMap([], satellite), LAYER_IDS.corridorHeatEvenHour)).toBe(
      "satellite-labels",
    );
  });

  it("inserts route layers beneath layers that must stay on top", () => {
    const map = fakeMap([LAYER_IDS.checkpoints], basemap);

    expect(resolveBeforeLayerId(map, LAYER_IDS.routeSegments)).toBe(LAYER_IDS.checkpoints);
    expect(resolveBeforeLayerId(map, LAYER_IDS.checkpoints)).toBeUndefined();
  });

  it("lists only layers present on the map", () => {
    const map = fakeMap([LAYER_IDS.checkpoints], basemap);

    expect(existingLayerIds(map, [LAYER_IDS.checkpoints, LAYER_IDS.routeHitArea])).toEqual([
      LAYER_IDS.checkpoints,
    ]);
  });
});
