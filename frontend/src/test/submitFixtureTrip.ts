import { useTripDraftStore } from "@/stores/tripDraftStore";
import { DALLAS_PLACE, DENVER_PLACE, tripPlan } from "./server";

export function submitFixtureTrip(): void {
  useTripDraftStore.getState().submitTrip({
    origin: DENVER_PLACE,
    destination: DALLAS_PLACE,
    request: {
      origin: { latitude: DENVER_PLACE.latitude, longitude: DENVER_PLACE.longitude },
      destination: { latitude: DALLAS_PLACE.latitude, longitude: DALLAS_PLACE.longitude },
      departure: tripPlan.departure,
      load_pounds: tripPlan.load_pounds,
      interval_miles: 50,
    },
  });
}
