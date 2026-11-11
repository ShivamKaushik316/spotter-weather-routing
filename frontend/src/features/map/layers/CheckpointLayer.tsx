import type { LayerSpecification } from "maplibre-gl";
import { useEffect, useMemo } from "react";
import type { TripPlan } from "@/shared/api/types";
import { MAP_THEME_COLORS } from "@/shared/config/mapStyles";
import { useThemeStore } from "@/shared/theme/themeStore";
import { useLayerStore } from "@/stores/layerStore";
import { selectFocusedRouteId, useSelectionStore } from "@/stores/selectionStore";
import { useGeoJsonLayers } from "../hooks/useGeoJsonLayers";
import { useLayerPointerEvents } from "../hooks/useLayerPointerEvents";
import { LAYER_IDS, SOURCE_IDS } from "../layerIds";
import { useMapContext } from "../mapContext";
import {
  checkpointRadiusExpression,
  focusedRouteValue,
  visibleRoutesFilter,
} from "../routeEmphasis";
import { buildCheckpointCollection } from "../routeFeatures";

const CHECKPOINT_LAYERS: LayerSpecification[] = [
  {
    id: LAYER_IDS.checkpoints,
    type: "circle",
    source: SOURCE_IDS.checkpoints,
    paint: {
      "circle-color": ["get", "color"],
      "circle-stroke-width": 2,
      "circle-radius": 4,
    },
  },
];

export function CheckpointLayer({ plan }: { plan: TripPlan }) {
  const { map, styleRevision } = useMapContext();
  const theme = useThemeStore((state) => state.theme);
  const isVisible = useLayerStore((state) => state.visibility.checkpoints);
  const showAlternates = useLayerStore((state) => state.visibility.alternates);
  const focusedRouteId = useSelectionStore(selectFocusedRouteId) ?? plan.recommended_route_id;
  const selectedCheckpoint = useSelectionStore((state) => state.selectedCheckpoint);
  const selectCheckpoint = useSelectionStore((state) => state.selectCheckpoint);
  const checkpoints = useMemo(() => buildCheckpointCollection(plan), [plan]);

  useGeoJsonLayers(SOURCE_IDS.checkpoints, checkpoints, CHECKPOINT_LAYERS);

  useLayerPointerEvents(LAYER_IDS.checkpoints, {
    onClick: (feature) =>
      selectCheckpoint({
        routeId: String(feature.properties.routeId),
        sequence: Number(feature.properties.sequence),
      }),
  });

  useEffect(() => {
    const layerId = LAYER_IDS.checkpoints;
    if (!map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", isVisible ? "visible" : "none");
    map.setFilter(
      layerId,
      visibleRoutesFilter(showAlternates, plan.recommended_route_id, focusedRouteId),
    );
    map.setPaintProperty(layerId, "circle-radius", checkpointRadiusExpression(selectedCheckpoint));
    map.setPaintProperty(layerId, "circle-opacity", focusedRouteValue(focusedRouteId, 1, 0.35));
    map.setPaintProperty(
      layerId,
      "circle-stroke-opacity",
      focusedRouteValue(focusedRouteId, 1, 0.35),
    );
    map.setPaintProperty(layerId, "circle-stroke-color", MAP_THEME_COLORS[theme].casing);
  }, [
    map,
    styleRevision,
    plan,
    isVisible,
    showAlternates,
    focusedRouteId,
    selectedCheckpoint,
    theme,
  ]);

  return null;
}
