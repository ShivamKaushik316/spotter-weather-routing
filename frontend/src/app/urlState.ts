import { z } from "zod";
import type { Place, SamplingInterval } from "@/shared/api/types";

export interface SharedTrip {
  origin: Place;
  destination: Place;
  departure: Date;
  loadPounds: number;
  intervalMiles: SamplingInterval;
}

const SEARCH_PARAMS = {
  origin: "from",
  originLabel: "fromName",
  destination: "to",
  destinationLabel: "toName",
  departure: "depart",
  loadPounds: "load",
  intervalMiles: "every",
} as const;

const COORDINATE_DECIMALS = 5;

const coordinatePairSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
  .transform((value) => value.split(",").map(Number) as [number, number])
  .refine(([latitude, longitude]) => Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180);

const sharedTripSchema = z.object({
  [SEARCH_PARAMS.origin]: coordinatePairSchema,
  [SEARCH_PARAMS.originLabel]: z.string().min(1).max(200),
  [SEARCH_PARAMS.destination]: coordinatePairSchema,
  [SEARCH_PARAMS.destinationLabel]: z.string().min(1).max(200),
  [SEARCH_PARAMS.departure]: z
    .string()
    .datetime({ offset: true })
    .transform((value) => new Date(value)),
  [SEARCH_PARAMS.loadPounds]: z.coerce.number().min(0).max(80_000),
  [SEARCH_PARAMS.intervalMiles]: z.coerce
    .number()
    .pipe(z.union([z.literal(10), z.literal(25), z.literal(50)])),
});

const toCoordinatePair = (place: Place) =>
  `${place.latitude.toFixed(COORDINATE_DECIMALS)},${place.longitude.toFixed(COORDINATE_DECIMALS)}`;

export function encodeTripSearch(trip: SharedTrip): string {
  return new URLSearchParams({
    [SEARCH_PARAMS.origin]: toCoordinatePair(trip.origin),
    [SEARCH_PARAMS.originLabel]: trip.origin.label,
    [SEARCH_PARAMS.destination]: toCoordinatePair(trip.destination),
    [SEARCH_PARAMS.destinationLabel]: trip.destination.label,
    [SEARCH_PARAMS.departure]: trip.departure.toISOString(),
    [SEARCH_PARAMS.loadPounds]: String(Math.round(trip.loadPounds)),
    [SEARCH_PARAMS.intervalMiles]: String(trip.intervalMiles),
  }).toString();
}

export function decodeTripSearch(search: string): SharedTrip | null {
  const parsed = sharedTripSchema.safeParse(Object.fromEntries(new URLSearchParams(search)));
  if (!parsed.success) return null;
  const values = parsed.data;
  const [originLatitude, originLongitude] = values[SEARCH_PARAMS.origin];
  const [destinationLatitude, destinationLongitude] = values[SEARCH_PARAMS.destination];
  return {
    origin: {
      label: values[SEARCH_PARAMS.originLabel],
      latitude: originLatitude,
      longitude: originLongitude,
    },
    destination: {
      label: values[SEARCH_PARAMS.destinationLabel],
      latitude: destinationLatitude,
      longitude: destinationLongitude,
    },
    departure: values[SEARCH_PARAMS.departure],
    loadPounds: values[SEARCH_PARAMS.loadPounds],
    intervalMiles: values[SEARCH_PARAMS.intervalMiles],
  };
}
