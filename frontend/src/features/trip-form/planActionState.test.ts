import { DALLAS_PLACE, DENVER_PLACE } from "@/test/server";
import type { TripDraft } from "@/stores/tripDraftStore";
import { describePlanAction } from "./planActionState";
import { validateTripDraft } from "./tripSchema";

const NOW = new Date("2026-11-10T12:00:00Z");

const completeDraft: TripDraft = {
  origin: DENVER_PLACE,
  destination: DALLAS_PLACE,
  departure: new Date("2026-11-10T14:00:00Z"),
  loadPounds: 42_000,
  intervalMiles: 25,
};

function submittedRequestFor(draft: TripDraft) {
  const validation = validateTripDraft(draft, NOW);
  if (!validation.success) throw new Error("Fixture draft must be valid.");
  return validation.trip.request;
}

describe("describePlanAction", () => {
  it("asks for endpoints before anything else", () => {
    const action = describePlanAction({ ...completeDraft, destination: null }, null, NOW);

    expect(action.kind).toBe("missing-endpoints");
    expect(action.summary).toMatch(/where the truck starts/);
  });

  it("summarises the trip before the first plan", () => {
    const action = describePlanAction(completeDraft, null, NOW);

    expect(action).toMatchObject({ kind: "first-plan", label: "Find safest route" });
    expect(action.summary).toMatch(/^Denver → Dallas · 42,000 lb · leaves /);
  });

  it("offers a refresh when the plan matches the inputs", () => {
    const action = describePlanAction(completeDraft, submittedRequestFor(completeDraft), NOW);

    expect(action).toMatchObject({ kind: "up-to-date", label: "Refresh forecast" });
  });

  it("asks to update when any input changed after planning", () => {
    const submitted = submittedRequestFor(completeDraft);

    const action = describePlanAction({ ...completeDraft, loadPounds: 20_000 }, submitted, NOW);

    expect(action).toMatchObject({ kind: "inputs-changed", label: "Update routes" });
  });
});
