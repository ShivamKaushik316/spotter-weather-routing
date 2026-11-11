import type { Place } from "@/shared/api/types";

export interface SampleTrip {
  name: string;
  origin: Place;
  destination: Place;
}

export const SAMPLE_TRIPS: readonly SampleTrip[] = [
  {
    name: "Denver → Dallas",
    origin: { label: "Denver, CO, USA", latitude: 39.7392, longitude: -104.9903 },
    destination: { label: "Dallas, TX, USA", latitude: 32.7767, longitude: -96.797 },
  },
  {
    name: "Chicago → St. Louis",
    origin: { label: "Chicago, IL, USA", latitude: 41.8781, longitude: -87.6298 },
    destination: { label: "St. Louis, MO, USA", latitude: 38.627, longitude: -90.1994 },
  },
  {
    name: "Seattle → Portland",
    origin: { label: "Seattle, WA, USA", latitude: 47.6062, longitude: -122.3321 },
    destination: { label: "Portland, OR, USA", latitude: 45.5152, longitude: -122.6784 },
  },
];
