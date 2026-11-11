import type { Map as MaplibreMap } from "maplibre-gl";
import { SATELLITE_LABEL_LAYER_ID } from "@/shared/config/mapStyles";

export const LAYER_IDS = {
  corridorHeatEvenHour: "corridor-heat-even-hour",
  corridorHeatOddHour: "corridor-heat-odd-hour",
  routeCasing: "route-casing",
  routeSegments: "route-segments",
  routeHitArea: "route-hit-area",
  checkpoints: "checkpoints",
} as const;

export const SOURCE_IDS = {
  corridorHeat: "corridor-heat",
  routeLines: "route-lines",
  routeSegments: "route-segments",
  checkpoints: "checkpoints",
} as const;

const HEATMAP_LAYER_IDS: readonly string[] = [
  LAYER_IDS.corridorHeatEvenHour,
  LAYER_IDS.corridorHeatOddHour,
];

const STACKING_ORDER: readonly string[] = [
  LAYER_IDS.routeCasing,
  LAYER_IDS.routeSegments,
  LAYER_IDS.routeHitArea,
  LAYER_IDS.checkpoints,
];

function firstBasemapLabelLayerId(map: MaplibreMap): string | undefined {
  return map
    .getStyle()
    .layers.find((layer) => layer.type === "symbol" || layer.id === SATELLITE_LABEL_LAYER_ID)?.id;
}

export function resolveBeforeLayerId(map: MaplibreMap, layerId: string): string | undefined {
  if (HEATMAP_LAYER_IDS.includes(layerId)) {
    return firstBasemapLabelLayerId(map) ?? STACKING_ORDER.find((id) => map.getLayer(id));
  }
  const stackIndex = STACKING_ORDER.indexOf(layerId);
  return STACKING_ORDER.slice(stackIndex + 1).find((id) => map.getLayer(id));
}

export function existingLayerIds(map: MaplibreMap, layerIds: readonly string[]): string[] {
  return layerIds.filter((layerId) => map.getLayer(layerId));
}
