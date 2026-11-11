import { DALLAS_PLACE, DENVER_PLACE } from "@/test/server";
import type { TripDraft } from "@/stores/tripDraftStore";
import { describeLoadRules } from "./loadRules";
import { validateTripDraft } from "./tripSchema";

const NOW = new Date("2026-11-10T12:00:00Z");

function draft(overrides: Partial<TripDraft> = {}): TripDraft {
  return {
    origin: DENVER_PLACE,
    destination: DALLAS_PLACE,
    departure: new Date("2026-11-10T14:00:00Z"),
    loadPounds: 42_000,
    intervalMiles: 25,
    ...overrides,
  };
}

describe("validateTripDraft", () => {
  it("builds the API request for a valid draft", () => {
    const result = validateTripDraft(draft(), NOW);

    expect(result).toEqual({
      success: true,
      trip: {
        origin: DENVER_PLACE,
        destination: DALLAS_PLACE,
        request: {
          origin: { latitude: DENVER_PLACE.latitude, longitude: DENVER_PLACE.longitude },
          destination: { latitude: DALLAS_PLACE.latitude, longitude: DALLAS_PLACE.longitude },
          departure: "2026-11-10T14:00:00.000Z",
          load_pounds: 42_000,
          interval_miles: 25,
        },
      },
    });
  });

  it.each([
    [{ origin: null }, "origin", "Choose an origin."],
    [{ destination: null }, "destination", "Choose a destination."],
    [{ destination: DENVER_PLACE }, "destination", "Destination must differ from the origin."],
    [
      { departure: new Date("2026-11-09T12:00:00Z") },
      "departure",
      "Departure cannot be in the past.",
    ],
    [
      { departure: new Date("2026-12-10T12:00:00Z") },
      "departure",
      "Departure must be within 14 days.",
    ],
    [{ loadPounds: 90_000 }, "loadPounds", "Load cannot exceed 80,000 lb."],
  ] as const)("rejects %o", (overrides, field, message) => {
    const result = validateTripDraft(draft(overrides), NOW);

    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.errors[field]).toBe(message);
  });
});

describe("describeLoadRules", () => {
  it.each([
    [10_000, "Standard thresholds."],
    [30_000, "Standard thresholds."],
    [30_001, "Load rule active."],
    [40_000, "Load rule active."],
    [40_001, "Heavy load rules active."],
  ])("describes %i lb as %s", (loadPounds, title) => {
    expect(describeLoadRules(loadPounds).title).toBe(title);
  });
});
