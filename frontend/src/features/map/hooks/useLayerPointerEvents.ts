import type { MapGeoJSONFeature, MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useMapContext } from "../mapContext";

interface LayerPointerHandlers {
  onClick?: (feature: MapGeoJSONFeature) => void;
  onHover?: (feature: MapGeoJSONFeature | null) => void;
}

const POINTER_CURSOR = "pointer";

export function useLayerPointerEvents(layerId: string, handlers: LayerPointerHandlers): void {
  const { map, styleRevision } = useMapContext();
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const canvas = map.getCanvas();
    const handleClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (feature) handlersRef.current.onClick?.(feature);
    };
    const handleMove = (event: MapLayerMouseEvent) => {
      canvas.style.cursor = POINTER_CURSOR;
      handlersRef.current.onHover?.(event.features?.[0] ?? null);
    };
    const handleLeave = () => {
      canvas.style.cursor = "";
      handlersRef.current.onHover?.(null);
    };
    map.on("click", layerId, handleClick);
    map.on("mousemove", layerId, handleMove);
    map.on("mouseleave", layerId, handleLeave);
    return () => {
      map.off("click", layerId, handleClick);
      map.off("mousemove", layerId, handleMove);
      map.off("mouseleave", layerId, handleLeave);
    };
  }, [map, styleRevision, layerId]);
}
