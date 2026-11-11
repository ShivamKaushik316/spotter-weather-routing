import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { useTripPlan } from "@/entities/trip";
import { INITIAL_MAP_VIEW, mapStyleFor, mapStyleKey } from "@/shared/config/mapStyles";
import { useThemeStore } from "@/shared/theme/themeStore";
import { useBasemapStore } from "@/stores/basemapStore";
import { applyBasemapPalette } from "./basemapPalette";
import { CheckpointLayer } from "./layers/CheckpointLayer";
import { EndpointMarkers } from "./layers/EndpointMarkers";
import { FitToPlan } from "./layers/FitToPlan";
import { HeatmapLayer } from "./layers/HeatmapLayer";
import { MapClickPicker } from "./layers/MapClickPicker";
import { RouteLayers } from "./layers/RouteLayers";
import { TruckMarkers } from "./layers/TruckMarkers";
import { MapContext, markMapRemoved, type MapContextValue } from "./mapContext";

function MapLayers() {
  const { data: plan } = useTripPlan();
  return (
    <>
      <EndpointMarkers />
      <MapClickPicker />
      {plan && (
        <>
          <HeatmapLayer plan={plan} />
          <RouteLayers plan={plan} />
          <CheckpointLayer plan={plan} />
          <TruckMarkers plan={plan} />
          <FitToPlan plan={plan} />
        </>
      )}
    </>
  );
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((state) => state.theme);
  const basemap = useBasemapStore((state) => state.basemap);
  const initialStyleRef = useRef(mapStyleFor(basemap, theme));
  const appliedStyleKeyRef = useRef(mapStyleKey(basemap, theme));
  const [mapContext, setMapContext] = useState<MapContextValue | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new maplibregl.Map({
      container,
      style: initialStyleRef.current,
      center: INITIAL_MAP_VIEW.center,
      zoom: INITIAL_MAP_VIEW.zoom,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 0,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    let styleRevision = 0;
    map.on("style.load", () => {
      applyBasemapPalette(map, appliedStyleKeyRef.current);
      styleRevision += 1;
      setMapContext({ map, styleRevision });
    });
    return () => {
      markMapRemoved(map);
      setMapContext(null);
      map.remove();
    };
  }, []);

  useEffect(() => {
    const styleKey = mapStyleKey(basemap, theme);
    if (!mapContext || appliedStyleKeyRef.current === styleKey) return;
    appliedStyleKeyRef.current = styleKey;
    mapContext.map.setStyle(mapStyleFor(basemap, theme), { diff: false });
  }, [mapContext, basemap, theme]);

  return (
    <>
      <div
        className="map-canvas absolute inset-0"
        role="region"
        aria-label="Route map. Click the map to pin the origin, then the destination."
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {mapContext && (
        <MapContext.Provider value={mapContext}>
          <MapLayers />
        </MapContext.Provider>
      )}
    </>
  );
}
