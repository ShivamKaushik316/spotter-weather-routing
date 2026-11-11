import maplibregl, { type Map as MaplibreMap, type Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { Place } from "@/shared/api/types";
import { useTripDraftStore } from "@/stores/tripDraftStore";
import { useMapContext } from "../mapContext";

function useEndpointMarker(
  map: MaplibreMap,
  place: Place | null,
  className: string,
  label: string,
) {
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!place) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const lngLat: [number, number] = [place.longitude, place.latitude];
    if (markerRef.current) {
      markerRef.current.setLngLat(lngLat);
    } else {
      const element = document.createElement("div");
      element.className = className;
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", label);
      markerRef.current = new maplibregl.Marker({ element }).setLngLat(lngLat).addTo(map);
    }
    markerRef.current.getElement().title = `${label}: ${place.label}`;
  }, [map, place, className, label]);

  useEffect(
    () => () => {
      markerRef.current?.remove();
    },
    [],
  );
}

export function EndpointMarkers() {
  const { map } = useMapContext();
  const origin = useTripDraftStore((state) => state.origin);
  const destination = useTripDraftStore((state) => state.destination);

  useEndpointMarker(map, origin, "endpoint-marker endpoint-marker--origin", "Origin");
  useEndpointMarker(
    map,
    destination,
    "endpoint-marker endpoint-marker--destination",
    "Destination",
  );

  return null;
}
