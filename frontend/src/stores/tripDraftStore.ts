import { create } from "zustand";
import type { Place, SamplingInterval, TripRequest } from "@/shared/api/types";
import { nextWholeHour } from "@/shared/lib/format";

export type EndpointRole = "origin" | "destination";

export interface SubmittedTrip {
  request: TripRequest;
  origin: Place;
  destination: Place;
}

export interface TripDraft {
  origin: Place | null;
  destination: Place | null;
  departure: Date;
  loadPounds: number;
  intervalMiles: SamplingInterval;
}

interface TripDraftState extends TripDraft {
  nextMapPick: EndpointRole;
  submittedTrip: SubmittedTrip | null;
  setEndpoint: (role: EndpointRole, place: Place | null) => void;
  pickEndpointFromMap: (place: Place) => EndpointRole;
  swapEndpoints: () => void;
  setDeparture: (departure: Date) => void;
  setLoadPounds: (loadPounds: number) => void;
  setIntervalMiles: (intervalMiles: SamplingInterval) => void;
  applyDraft: (draft: Partial<TripDraft>) => void;
  submitTrip: (submittedTrip: SubmittedTrip) => void;
}

export const DEFAULT_LOAD_POUNDS = 42_000;
export const DEFAULT_INTERVAL_MILES: SamplingInterval = 25;

export const useTripDraftStore = create<TripDraftState>()((set, get) => ({
  origin: null,
  destination: null,
  departure: nextWholeHour(),
  loadPounds: DEFAULT_LOAD_POUNDS,
  intervalMiles: DEFAULT_INTERVAL_MILES,
  nextMapPick: "origin",
  submittedTrip: null,
  setEndpoint: (role, place) => {
    if (role === "origin") set({ origin: place, nextMapPick: place ? "destination" : "origin" });
    else set({ destination: place, nextMapPick: place ? "origin" : "destination" });
  },
  pickEndpointFromMap: (place) => {
    const role = get().nextMapPick;
    get().setEndpoint(role, place);
    return role;
  },
  swapEndpoints: () => set((state) => ({ origin: state.destination, destination: state.origin })),
  setDeparture: (departure) => set({ departure }),
  setLoadPounds: (loadPounds) => set({ loadPounds }),
  setIntervalMiles: (intervalMiles) => set({ intervalMiles }),
  applyDraft: (draft) => set(draft),
  submitTrip: (submittedTrip) => set({ submittedTrip }),
}));
