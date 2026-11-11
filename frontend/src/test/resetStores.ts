import { nextWholeHour } from "@/shared/lib/format";
import { useLayerStore } from "@/stores/layerStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { useTimelineStore } from "@/stores/timelineStore";
import {
  DEFAULT_INTERVAL_MILES,
  DEFAULT_LOAD_POUNDS,
  useTripDraftStore,
} from "@/stores/tripDraftStore";

export function resetStores(): void {
  useTripDraftStore.setState({
    origin: null,
    destination: null,
    departure: nextWholeHour(),
    loadPounds: DEFAULT_LOAD_POUNDS,
    intervalMiles: DEFAULT_INTERVAL_MILES,
    nextMapPick: "origin",
    submittedTrip: null,
  });
  useSelectionStore.setState({
    selectedRouteId: null,
    hoveredRouteId: null,
    selectedCheckpoint: null,
  });
  useTimelineStore.setState({ hour: 0, isPlaying: false, speed: 1 });
  useLayerStore.setState({ visibility: { heatmap: true, checkpoints: true, alternates: true } });
}
