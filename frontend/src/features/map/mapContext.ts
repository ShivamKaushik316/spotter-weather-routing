import type { Map as MaplibreMap } from "maplibre-gl";
import { createContext, useContext } from "react";

export interface MapContextValue {
  map: MaplibreMap;
  styleRevision: number;
}

export const MapContext = createContext<MapContextValue | null>(null);

export function useMapContext(): MapContextValue {
  const context = useContext(MapContext);
  if (!context) throw new Error("Map layers must be rendered inside MapView.");
  return context;
}

const removedMaps = new WeakSet<MaplibreMap>();

export function markMapRemoved(map: MaplibreMap): void {
  removedMaps.add(map);
}

export function isMapUsable(map: MaplibreMap): boolean {
  return !removedMaps.has(map);
}
