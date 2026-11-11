import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, LayerSpecification } from "maplibre-gl";
import { useEffect } from "react";
import { resolveBeforeLayerId } from "../layerIds";
import { isMapUsable, useMapContext } from "../mapContext";

const EMPTY_COLLECTION: FeatureCollection = { type: "FeatureCollection", features: [] };

export function useGeoJsonLayers(
  sourceId: string,
  data: FeatureCollection | null,
  layers: readonly LayerSpecification[],
): void {
  const { map, styleRevision } = useMapContext();

  useEffect(() => {
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: "geojson", data: EMPTY_COLLECTION });
    }
    for (const layer of layers) {
      if (!map.getLayer(layer.id)) map.addLayer(layer, resolveBeforeLayerId(map, layer.id));
    }
    return () => {
      if (!isMapUsable(map)) return;
      for (const layer of layers) {
        if (map.getLayer(layer.id)) map.removeLayer(layer.id);
      }
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map, styleRevision, sourceId, layers]);

  useEffect(() => {
    map.getSource<GeoJSONSource>(sourceId)?.setData(data ?? EMPTY_COLLECTION);
  }, [map, styleRevision, sourceId, data]);
}
