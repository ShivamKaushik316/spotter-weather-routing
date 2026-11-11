import { useCallback, useState } from "react";
import { useTripDraftStore } from "@/stores/tripDraftStore";
import { validateTripDraft, type TripFormErrors } from "./tripSchema";

export function useSubmitTrip() {
  const [errors, setErrors] = useState<TripFormErrors>({});

  const submit = useCallback((): boolean => {
    const { origin, destination, departure, loadPounds, intervalMiles, submitTrip } =
      useTripDraftStore.getState();
    const validation = validateTripDraft({
      origin,
      destination,
      departure,
      loadPounds,
      intervalMiles,
    });
    if (!validation.success) {
      setErrors(validation.errors);
      return false;
    }
    setErrors({});
    submitTrip(validation.trip);
    return true;
  }, []);

  const clearError = useCallback((field: keyof TripFormErrors) => {
    setErrors((current) => {
      if (!(field in current)) return current;
      return Object.fromEntries(
        Object.entries(current).filter(([errorField]) => errorField !== field),
      ) as TripFormErrors;
    });
  }, []);

  return { errors, submit, clearError };
}
