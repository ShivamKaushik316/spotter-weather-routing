import type { MapMouseEvent } from "maplibre-gl";
import { useEffect } from "react";
import { showToast } from "@/shared/ui/toastStore";
import { useTripDraftStore } from "@/stores/tripDraftStore";
import { existingLayerIds, LAYER_IDS } from "../layerIds";
import { useMapContext } from "../mapContext";

const INTERACTIVE_LAYER_IDS = [LAYER_IDS.checkpoints, LAYER_IDS.routeHitArea];
const COORDINATE_DECIMALS = 4;

export function MapClickPicker() {
  const { map } = useMapContext();

  useEffect(() => {
    const handleClick = (event: MapMouseEvent) => {
      const interactiveLayers = existingLayerIds(map, INTERACTIVE_LAYER_IDS);
      if (
        interactiveLayers.length > 0 &&
        map.queryRenderedFeatures(event.point, { layers: interactiveLayers }).length > 0
      ) {
        return;
      }
      const { lng, lat } = event.lngLat.wrap();
      const pickedRole = useTripDraftStore.getState().pickEndpointFromMap({
        label: `Pinned ${lat.toFixed(COORDINATE_DECIMALS)}, ${lng.toFixed(COORDINATE_DECIMALS)}`,
        latitude: lat,
        longitude: lng,
      });
      showToast(
        pickedRole === "origin"
          ? {
              tone: "info",
              title: "Origin pinned",
              description: "Click the map again to set the destination.",
            }
          : {
              tone: "info",
              title: "Destination pinned",
              description: "Press “Plan safest route” to compare routes.",
            },
      );
    };
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map]);

  return null;
}
