import maplibregl from "maplibre-gl";
import { useEffect } from "react";
import type { TripPlan } from "@/shared/api/types";
import { fitPaddingFor } from "../fitPadding";
import { useMapContext } from "../mapContext";
import { collectPlanCoordinates } from "../routeFeatures";

const FIT_ANIMATION_MILLISECONDS = 900;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function FitToPlan({ plan }: { plan: TripPlan }) {
  const { map } = useMapContext();

  useEffect(() => {
    const coordinates = collectPlanCoordinates(plan);
    const firstCoordinate = coordinates[0];
    if (!firstCoordinate) return;
    const bounds = coordinates.reduce(
      (extent, coordinate) => extent.extend([coordinate[0], coordinate[1]]),
      new maplibregl.LngLatBounds(
        [firstCoordinate[0], firstCoordinate[1]],
        [firstCoordinate[0], firstCoordinate[1]],
      ),
    );
    const container = map.getContainer();
    map.fitBounds(bounds, {
      padding: fitPaddingFor({ width: container.clientWidth, height: container.clientHeight }),
      duration: prefersReducedMotion() ? 0 : FIT_ANIMATION_MILLISECONDS,
    });
  }, [map, plan]);

  return null;
}
