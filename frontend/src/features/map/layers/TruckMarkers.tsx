import maplibregl, { type Marker } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { RouteTimeline } from "@/entities/route";
import type { TripPlan } from "@/shared/api/types";
import { useLayerStore } from "@/stores/layerStore";
import { selectFocusedRouteId, useSelectionStore } from "@/stores/selectionStore";
import { useTimelineHourEffect } from "@/stores/useTimelineHourEffect";
import { useMapContext } from "../mapContext";

const MILLISECONDS_PER_HOUR = 3_600_000;
const TRUCK_ARROW_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 3l7 17-7-4-7 4z" fill="currentColor"/></svg>';

interface TruckMarker {
  timeline: RouteTimeline;
  marker: Marker;
}

function createTruckElement(routeId: string): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "truck-marker";
  element.dataset.routeId = routeId;
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", `Truck on route ${routeId}`);
  element.innerHTML = TRUCK_ARROW_SVG;
  return element;
}

export function TruckMarkers({ plan }: { plan: TripPlan }) {
  const { map } = useMapContext();
  const showAlternates = useLayerStore((state) => state.visibility.alternates);
  const focusedRouteId = useSelectionStore(selectFocusedRouteId) ?? plan.recommended_route_id;
  const trucksRef = useRef<TruckMarker[]>([]);
  const departureMilliseconds = useMemo(() => Date.parse(plan.departure), [plan.departure]);

  useEffect(() => {
    const trucks = plan.routes
      .filter((route) => route.checkpoints.length > 1 && route.geometry.coordinates.length > 1)
      .map((route) => {
        const timeline = new RouteTimeline(route);
        const start = timeline.positionAt(departureMilliseconds);
        const marker = new maplibregl.Marker({
          element: createTruckElement(route.route_id),
          rotationAlignment: "map",
          pitchAlignment: "map",
        })
          .setLngLat([start.coordinate[0], start.coordinate[1]])
          .setRotation(start.bearing)
          .addTo(map);
        return { timeline, marker };
      });
    trucksRef.current = trucks;
    return () => {
      for (const truck of trucks) truck.marker.remove();
      trucksRef.current = [];
    };
  }, [map, plan, departureMilliseconds]);

  useEffect(() => {
    for (const { timeline, marker } of trucksRef.current) {
      const element = marker.getElement();
      const isFocused = timeline.routeId === focusedRouteId;
      const isRecommended = timeline.routeId === plan.recommended_route_id;
      element.classList.toggle("truck-marker--dimmed", !isFocused);
      element.hidden = !showAlternates && !isFocused && !isRecommended;
    }
  }, [plan, focusedRouteId, showAlternates]);

  const renderHour = useCallback(
    (hour: number) => {
      const moment = departureMilliseconds + hour * MILLISECONDS_PER_HOUR;
      for (const { timeline, marker } of trucksRef.current) {
        const position = timeline.positionAt(moment);
        marker.setLngLat([position.coordinate[0], position.coordinate[1]]);
        marker.setRotation(position.bearing);
      }
    },
    [departureMilliseconds],
  );

  useTimelineHourEffect(renderHour);

  return null;
}
