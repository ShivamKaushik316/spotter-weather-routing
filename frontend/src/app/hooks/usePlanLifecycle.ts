import { useEffect } from "react";
import { useTripPlan } from "@/entities/trip";
import { useSelectionStore } from "@/stores/selectionStore";
import { useTimelineStore } from "@/stores/timelineStore";

export function usePlanLifecycle(): void {
  const { data: plan } = useTripPlan();

  useEffect(() => {
    if (!plan) return;
    useSelectionStore.getState().resetForPlan(plan.recommended_route_id);
    useTimelineStore.getState().reset();
  }, [plan]);
}
