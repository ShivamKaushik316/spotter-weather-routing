import { useEffect } from "react";
import { validateTripDraft } from "@/features/trip-form";
import { nextWholeHour } from "@/shared/lib/format";
import { useTripDraftStore } from "@/stores/tripDraftStore";
import { decodeTripSearch, encodeTripSearch } from "../urlState";

function restoreSharedTrip(): void {
  const sharedTrip = decodeTripSearch(window.location.search);
  if (!sharedTrip) return;
  const departure =
    sharedTrip.departure.getTime() < Date.now() ? nextWholeHour() : sharedTrip.departure;
  const draft = { ...sharedTrip, departure };
  const store = useTripDraftStore.getState();
  store.applyDraft(draft);
  const validation = validateTripDraft(draft);
  if (validation.success) store.submitTrip(validation.trip);
}

export function useUrlSync(): void {
  useEffect(() => {
    restoreSharedTrip();
    return useTripDraftStore.subscribe((state, previousState) => {
      const submittedTrip = state.submittedTrip;
      if (!submittedTrip || submittedTrip === previousState.submittedTrip) return;
      const { origin, destination, request } = submittedTrip;
      const search = encodeTripSearch({
        origin,
        destination,
        departure: new Date(request.departure),
        loadPounds: request.load_pounds,
        intervalMiles: request.interval_miles,
      });
      window.history.replaceState(null, "", `${window.location.pathname}?${search}`);
    });
  }, []);
}
