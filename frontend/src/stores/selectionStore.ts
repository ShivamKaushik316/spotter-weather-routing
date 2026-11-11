import { create } from "zustand";

export interface CheckpointSelection {
  routeId: string;
  sequence: number;
}

interface SelectionState {
  selectedRouteId: string | null;
  hoveredRouteId: string | null;
  selectedCheckpoint: CheckpointSelection | null;
  selectRoute: (routeId: string) => void;
  hoverRoute: (routeId: string | null) => void;
  selectCheckpoint: (checkpoint: CheckpointSelection) => void;
  closeCheckpoint: () => void;
  resetForPlan: (recommendedRouteId: string) => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedRouteId: null,
  hoveredRouteId: null,
  selectedCheckpoint: null,
  selectRoute: (routeId) => set({ selectedRouteId: routeId }),
  hoverRoute: (routeId) => set({ hoveredRouteId: routeId }),
  selectCheckpoint: (checkpoint) =>
    set({ selectedCheckpoint: checkpoint, selectedRouteId: checkpoint.routeId }),
  closeCheckpoint: () => set({ selectedCheckpoint: null }),
  resetForPlan: (recommendedRouteId) =>
    set({ selectedRouteId: recommendedRouteId, hoveredRouteId: null, selectedCheckpoint: null }),
}));

export const selectFocusedRouteId = (state: SelectionState): string | null =>
  state.hoveredRouteId ?? state.selectedRouteId;
