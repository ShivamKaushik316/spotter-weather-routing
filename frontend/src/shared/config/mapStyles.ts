import type { StyleSpecification } from "maplibre-gl";

export type ThemeName = "dark" | "light";
export type BasemapName = "streets" | "satellite";

export const MAP_STYLE_URLS: Record<ThemeName, string> = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

export const SATELLITE_LABEL_LAYER_ID = "satellite-labels";
const ESRI_TILE_ROOT = "https://server.arcgisonline.com/ArcGIS/rest/services";
const RASTER_TILE_SIZE = 256;
const SATELLITE_MAX_ZOOM = 19;

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "satellite-imagery": {
      type: "raster",
      tiles: [`${ESRI_TILE_ROOT}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      tileSize: RASTER_TILE_SIZE,
      maxzoom: SATELLITE_MAX_ZOOM,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
    "satellite-reference": {
      type: "raster",
      tiles: [`${ESRI_TILE_ROOT}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
      tileSize: RASTER_TILE_SIZE,
      maxzoom: SATELLITE_MAX_ZOOM,
    },
  },
  layers: [
    { id: "satellite-imagery", type: "raster", source: "satellite-imagery" },
    { id: SATELLITE_LABEL_LAYER_ID, type: "raster", source: "satellite-reference" },
  ],
};

export function mapStyleKey(basemap: BasemapName, theme: ThemeName): string {
  return basemap === "satellite" ? "satellite" : `streets-${theme}`;
}

export function mapStyleFor(basemap: BasemapName, theme: ThemeName): string | StyleSpecification {
  return basemap === "satellite" ? SATELLITE_STYLE : MAP_STYLE_URLS[theme];
}

export const MAP_THEME_COLORS: Record<
  ThemeName,
  { casing: string; accent: string; accentInk: string }
> = {
  dark: { casing: "#050814", accent: "#22D3EE", accentInk: "#04222A" },
  light: { casing: "#FFFFFF", accent: "#0891B2", accentInk: "#FFFFFF" },
};

export const INITIAL_MAP_VIEW = { center: [-98.5, 38.5] as [number, number], zoom: 3.7 };
