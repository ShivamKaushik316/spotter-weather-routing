import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { GeocodeResults, TripPlan } from "@/shared/api/types";
import tripPlanFixture from "./fixtures/tripPlan.json";

export const API_BASE_URL = "http://api.test";
export const tripPlan = tripPlanFixture as unknown as TripPlan;

export const DENVER_PLACE = { label: "Denver, CO, USA", latitude: 39.7392, longitude: -104.9903 };
export const DALLAS_PLACE = { label: "Dallas, TX, USA", latitude: 32.7767, longitude: -96.797 };

const geocodeResults: GeocodeResults = {
  results: [DENVER_PLACE, { label: "Denton, TX, USA", latitude: 33.2148, longitude: -97.1331 }],
  meta: { request_id: "test-geocode", timings_ms: {}, counters: {}, labels: {} },
};

export const handlers = [
  http.post(`${API_BASE_URL}/api/trips/plan`, () => HttpResponse.json(tripPlan)),
  http.get(`${API_BASE_URL}/api/geocode`, () => HttpResponse.json(geocodeResults)),
  http.post(`${API_BASE_URL}/api/trips/heatmap`, () =>
    HttpResponse.json({ type: "FeatureCollection", hours: [], features: [], meta: tripPlan.meta }),
  ),
  http.post(`${API_BASE_URL}/api/trips/departure-window`, () =>
    HttpResponse.json({}, { status: 503 }),
  ),
];

export const server = setupServer(...handlers);
