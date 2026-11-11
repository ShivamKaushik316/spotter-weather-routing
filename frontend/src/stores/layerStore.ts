import { create } from "zustand";

export type MapLayerName = "heatmap" | "checkpoints" | "alternates";

interface LayerState {
  visibility: Record<MapLayerName, boolean>;
  toggleLayer: (layer: MapLayerName) => void;
}

export const useLayerStore = create<LayerState>()((set) => ({
  visibility: { heatmap: true, checkpoints: true, alternates: true },
  toggleLayer: (layer) =>
    set((state) => ({ visibility: { ...state.visibility, [layer]: !state.visibility[layer] } })),
}));
