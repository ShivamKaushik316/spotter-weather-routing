import type { Map as MapLibreMap } from "maplibre-gl";

interface PaintOverride {
  layerId: string;
  property: string;
  value: string;
}

const NIGHT_DISPATCH_COLORS = {
  land: "#141d33",
  water: "#090f1d",
  waterway: "#1d3550",
  countyBoundary: "#1c2740",
  stateBoundary: "rgba(148, 163, 184, 0.38)",
  countryBoundary: "#56637a",
} as const;

const LAND_LAYER_IDS = [
  "background",
  "landcover",
  "landuse",
  "park_national_park",
  "park_nature_reserve",
];

const DARK_STREETS_OVERRIDES: readonly PaintOverride[] = [
  ...LAND_LAYER_IDS.map((layerId) => ({
    layerId,
    property: layerId === "background" ? "background-color" : "fill-color",
    value: NIGHT_DISPATCH_COLORS.land,
  })),
  { layerId: "water", property: "fill-color", value: NIGHT_DISPATCH_COLORS.water },
  { layerId: "waterway", property: "line-color", value: NIGHT_DISPATCH_COLORS.waterway },
  {
    layerId: "boundary_county",
    property: "line-color",
    value: NIGHT_DISPATCH_COLORS.countyBoundary,
  },
  {
    layerId: "boundary_state",
    property: "line-color",
    value: NIGHT_DISPATCH_COLORS.stateBoundary,
  },
  {
    layerId: "boundary_country_inner",
    property: "line-color",
    value: NIGHT_DISPATCH_COLORS.countryBoundary,
  },
  {
    layerId: "boundary_country_outline",
    property: "line-color",
    value: NIGHT_DISPATCH_COLORS.countryBoundary,
  },
];

const OVERRIDES_BY_STYLE_KEY: Record<string, readonly PaintOverride[]> = {
  "streets-dark": DARK_STREETS_OVERRIDES,
};

export function applyBasemapPalette(map: MapLibreMap, styleKey: string): void {
  for (const override of OVERRIDES_BY_STYLE_KEY[styleKey] ?? []) {
    if (map.getLayer(override.layerId)) {
      map.setPaintProperty(override.layerId, override.property, override.value);
    }
  }
}
