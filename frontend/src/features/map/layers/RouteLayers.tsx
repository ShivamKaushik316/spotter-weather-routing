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
import { focusedRouteValue, routeSortKey, visibleRoutesFilter } from "../routeEmphasis";
import { buildRouteLineCollection, buildRouteSegmentCollection } from "../routeFeatures";

const ROUND_LINE_LAYOUT = { "line-join": "round", "line-cap": "round" } as const;

const ROUTE_LINE_LAYERS: LayerSpecification[] = [
  {
    id: LAYER_IDS.routeCasing,
    type: "line",
    source: SOURCE_IDS.routeLines,
    layout: ROUND_LINE_LAYOUT,
    paint: {
      "line-color": MAP_THEME_COLORS.dark.casing,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        ["case", ["get", "isRecommended"], 10, 8],
        10,
        ["case", ["get", "isRecommended"], 16, 12],
      ],
    },
  },
  {
    id: LAYER_IDS.routeHitArea,
    type: "line",
    source: SOURCE_IDS.routeLines,
    layout: ROUND_LINE_LAYOUT,
    paint: { "line-width": 22, "line-opacity": 0 },
  },
];

const ROUTE_SEGMENT_LAYERS: LayerSpecification[] = [
  {
    id: LAYER_IDS.routeSegments,
    type: "line",
    source: SOURCE_IDS.routeSegments,
    layout: ROUND_LINE_LAYOUT,
    paint: {
      "line-color": ["get", "color"],
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        ["case", ["get", "isRecommended"], 5.5, 4],
        10,
        ["case", ["get", "isRecommended"], 10, 7],
      ],
    },
  },
];

const EMPHASIZED_LAYER_IDS = [
  LAYER_IDS.routeCasing,
  LAYER_IDS.routeSegments,
  LAYER_IDS.routeHitArea,
];

export function RouteLayers({ plan }: { plan: TripPlan }) {
  const { map, styleRevision } = useMapContext();
  const theme = useThemeStore((state) => state.theme);
  const focusedRouteId = useSelectionStore(selectFocusedRouteId) ?? plan.recommended_route_id;
  const selectRoute = useSelectionStore((state) => state.selectRoute);
  const hoverRoute = useSelectionStore((state) => state.hoverRoute);
  const showAlternates = useLayerStore((state) => state.visibility.alternates);
  const routeLines = useMemo(() => buildRouteLineCollection(plan), [plan]);
  const routeSegments = useMemo(() => buildRouteSegmentCollection(plan), [plan]);

  useGeoJsonLayers(SOURCE_IDS.routeLines, routeLines, ROUTE_LINE_LAYERS);
  useGeoJsonLayers(SOURCE_IDS.routeSegments, routeSegments, ROUTE_SEGMENT_LAYERS);

  useLayerPointerEvents(LAYER_IDS.routeHitArea, {
    onClick: (feature) => selectRoute(String(feature.properties.routeId)),
    onHover: (feature) => hoverRoute(feature ? String(feature.properties.routeId) : null),
  });

  useEffect(() => {
    const filter = visibleRoutesFilter(showAlternates, plan.recommended_route_id, focusedRouteId);
    const sortKey = routeSortKey(focusedRouteId, plan.recommended_route_id);
    for (const layerId of EMPHASIZED_LAYER_IDS) {
      if (!map.getLayer(layerId)) continue;
      map.setFilter(layerId, filter);
      map.setLayoutProperty(layerId, "line-sort-key", sortKey);
    }
    if (map.getLayer(LAYER_IDS.routeCasing)) {
      map.setPaintProperty(LAYER_IDS.routeCasing, "line-color", MAP_THEME_COLORS[theme].casing);
      map.setPaintProperty(
        LAYER_IDS.routeCasing,
        "line-opacity",
        focusedRouteValue(focusedRouteId, 1, 0.6),
      );
    }
    if (map.getLayer(LAYER_IDS.routeSegments)) {
      map.setPaintProperty(
        LAYER_IDS.routeSegments,
        "line-opacity",
        focusedRouteValue(focusedRouteId, 1, 0.35),
      );
    }
  }, [map, styleRevision, plan, focusedRouteId, showAlternates, theme]);

  return null;
}
