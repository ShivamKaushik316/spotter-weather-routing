import type { FeatureCollection } from "geojson";
import type { HeatmapLayerSpecification, LayerSpecification } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCorridorHeatmap } from "@/entities/trip";
import type { TripPlan } from "@/shared/api/types";
import { useThemeStore } from "@/shared/theme/themeStore";
import { useLayerStore } from "@/stores/layerStore";
import { useTimelineHourEffect } from "@/stores/useTimelineHourEffect";
import { heatmapCrossfade, hourlyHeatWeight } from "../heatmapExpression";
import { useGeoJsonLayers } from "../hooks/useGeoJsonLayers";
import { LAYER_IDS, SOURCE_IDS } from "../layerIds";
import { useMapContext } from "../mapContext";

const HEATMAP_OPACITY_BY_THEME = { dark: 0.85, light: 0.72 } as const;

const SHARED_HEATMAP_PAINT: HeatmapLayerSpecification["paint"] = {
  "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 6, 0.95, 10, 1.7],
  "heatmap-radius": [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    3,
    8,
    4,
    13,
    6,
    44,
    8,
    160,
    10,
    600,
  ],
  "heatmap-color": [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    "rgba(234,179,8,0)",
    0.08,
    "rgba(234,179,8,0.34)",
    0.3,
    "rgba(249,115,22,0.52)",
    0.55,
    "rgba(239,68,68,0.66)",
    0.85,
    "rgba(255,43,214,0.78)",
  ],
};

const INSTANT_TRANSITION = { duration: 0, delay: 0 };
const HEATMAP_LAYER_IDS = [LAYER_IDS.corridorHeatEvenHour, LAYER_IDS.corridorHeatOddHour];

function heatmapLayer(id: string, hour: number, opacity: number): LayerSpecification {
  return {
    id,
    type: "heatmap",
    source: SOURCE_IDS.corridorHeat,
    maxzoom: 12,
    paint: {
      ...SHARED_HEATMAP_PAINT,
      "heatmap-weight": hourlyHeatWeight(hour),
      "heatmap-opacity": opacity,
    },
  };
}

const HEATMAP_LAYERS: LayerSpecification[] = [
  heatmapLayer(LAYER_IDS.corridorHeatEvenHour, 0, HEATMAP_OPACITY_BY_THEME.dark),
  heatmapLayer(LAYER_IDS.corridorHeatOddHour, 1, 0),
];

interface AppliedHours {
  even: number;
  odd: number;
}

const INITIAL_APPLIED_HOURS: AppliedHours = { even: 0, odd: 1 };

export function HeatmapLayer({ plan }: { plan: TripPlan }) {
  const { map, styleRevision } = useMapContext();
  const theme = useThemeStore((state) => state.theme);
  const isVisible = useLayerStore((state) => state.visibility.heatmap);
  const { data: heatmap } = useCorridorHeatmap(plan);
  const appliedHoursRef = useRef<AppliedHours>(INITIAL_APPLIED_HOURS);
  const collection = useMemo<FeatureCollection | null>(
    () => (heatmap ? { type: "FeatureCollection", features: heatmap.features } : null),
    [heatmap],
  );

  useGeoJsonLayers(SOURCE_IDS.corridorHeat, collection, HEATMAP_LAYERS);

  useEffect(() => {
    appliedHoursRef.current = INITIAL_APPLIED_HOURS;
    for (const layerId of HEATMAP_LAYER_IDS) {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, "heatmap-opacity-transition", INSTANT_TRANSITION);
      }
    }
  }, [map, styleRevision]);

  useEffect(() => {
    for (const layerId of [LAYER_IDS.corridorHeatEvenHour, LAYER_IDS.corridorHeatOddHour]) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", isVisible ? "visible" : "none");
      }
    }
  }, [map, styleRevision, isVisible]);

  const renderHour = useCallback(
    (hour: number) => {
      const evenLayerId = LAYER_IDS.corridorHeatEvenHour;
      const oddLayerId = LAYER_IDS.corridorHeatOddHour;
      if (styleRevision < 1 || !map.getLayer(evenLayerId) || !map.getLayer(oddLayerId)) return;
      const crossfade = heatmapCrossfade(hour);
      const appliedHours = appliedHoursRef.current;
      if (crossfade.evenHour !== appliedHours.even) {
        map.setPaintProperty(evenLayerId, "heatmap-weight", hourlyHeatWeight(crossfade.evenHour));
      }
      if (crossfade.oddHour !== appliedHours.odd) {
        map.setPaintProperty(oddLayerId, "heatmap-weight", hourlyHeatWeight(crossfade.oddHour));
      }
      appliedHoursRef.current = { even: crossfade.evenHour, odd: crossfade.oddHour };
      const baseOpacity = HEATMAP_OPACITY_BY_THEME[theme];
      map.setPaintProperty(
        evenLayerId,
        "heatmap-opacity",
        baseOpacity * crossfade.evenOpacityRatio,
      );
      map.setPaintProperty(oddLayerId, "heatmap-opacity", baseOpacity * crossfade.oddOpacityRatio);
    },
    [map, styleRevision, theme],
  );

  useTimelineHourEffect(renderHour);

  return null;
}
