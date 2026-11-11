import { z } from "zod";
import type { Place, TripRequest } from "@/shared/api/types";
import { haversineMiles } from "@/shared/lib/geometry";
import type { SubmittedTrip, TripDraft } from "@/stores/tripDraftStore";

export const MAXIMUM_LOAD_POUNDS = 80_000;
const DEPARTURE_PAST_TOLERANCE_MILLISECONDS = 30 * 60 * 1000;
const MAXIMUM_DEPARTURE_LEAD_DAYS = 14;
const MINIMUM_TRIP_MILES = 1;

export type TripFormField = keyof TripDraft;
export type TripFormErrors = Partial<Record<TripFormField, string>>;

const placeSchema = (missingMessage: string) =>
  z.object(
    {
      label: z.string(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    },
    { invalid_type_error: missingMessage, required_error: missingMessage },
  );

export function buildTripFormSchema(now: Date) {
  const earliestDeparture = new Date(now.getTime() - DEPARTURE_PAST_TOLERANCE_MILLISECONDS);
  const latestDeparture = new Date(now);
  latestDeparture.setDate(latestDeparture.getDate() + MAXIMUM_DEPARTURE_LEAD_DAYS);

  return z
    .object({
      origin: placeSchema("Choose an origin."),
      destination: placeSchema("Choose a destination."),
      departure: z
        .date({ invalid_type_error: "Choose a departure time." })
        .min(earliestDeparture, "Departure cannot be in the past.")
        .max(latestDeparture, `Departure must be within ${MAXIMUM_DEPARTURE_LEAD_DAYS} days.`),
      loadPounds: z
        .number({ invalid_type_error: "Enter the load weight." })
        .min(0, "Load cannot be negative.")
        .max(MAXIMUM_LOAD_POUNDS, "Load cannot exceed 80,000 lb."),
      intervalMiles: z.union([z.literal(10), z.literal(25), z.literal(50)]),
    })
    .refine(
      ({ origin, destination }) =>
        haversineMiles(
          [origin.longitude, origin.latitude],
          [destination.longitude, destination.latitude],
        ) >= MINIMUM_TRIP_MILES,
      { path: ["destination"], message: "Destination must differ from the origin." },
    );
}

export type TripValidationResult =
  | { success: true; trip: SubmittedTrip }
  | { success: false; errors: TripFormErrors };

function toTripRequest(
  origin: Place,
  destination: Place,
  draft: Pick<TripDraft, "departure" | "loadPounds" | "intervalMiles">,
): TripRequest {
  return {
    origin: { latitude: origin.latitude, longitude: origin.longitude },
    destination: { latitude: destination.latitude, longitude: destination.longitude },
    departure: draft.departure.toISOString(),
    load_pounds: Math.round(draft.loadPounds),
    interval_miles: draft.intervalMiles,
  };
}

export function validateTripDraft(draft: TripDraft, now: Date = new Date()): TripValidationResult {
  const result = buildTripFormSchema(now).safeParse(draft);
  if (!result.success) {
    const errors: TripFormErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as TripFormField | undefined;
      if (field && !errors[field]) errors[field] = issue.message;
    }
    return { success: false, errors };
  }
  const { origin, destination } = result.data;
  return {
    success: true,
    trip: { request: toTripRequest(origin, destination, result.data), origin, destination },
  };
}
