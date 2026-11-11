import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { DepartureOption, DepartureWindowPlan } from "@/shared/api/types";
import { useTripDraftStore } from "@/stores/tripDraftStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import { API_BASE_URL, server, tripPlan } from "@/test/server";
import { submitFixtureTrip } from "@/test/submitFixtureTrip";
import { DepartureWindowCard } from "./DepartureWindowCard";

const HOUR = 3_600_000;
const departure = Date.parse(tripPlan.departure);
const baseSummary = tripPlan.routes[0]!.summary;

function option(delayHours: number, averageRisk: number, change: string): DepartureOption {
  return {
    departure: new Date(departure + delayHours * HOUR).toISOString(),
    delay_hours: delayHours,
    best_route_id: "A",
    summary: { ...baseSummary, average_risk_score: averageRisk },
    change_from_baseline: change,
  };
}

function respondWith(options: DepartureOption[]): void {
  const plan: DepartureWindowPlan = {
    baseline: options.find((candidate) => candidate.delay_hours === 0)!,
    recommended_option: options[0]!,
    options,
    meta: tripPlan.meta,
  };
  server.use(
    http.post(`${API_BASE_URL}/api/trips/departure-window`, () => HttpResponse.json(plan)),
  );
}

describe("DepartureWindowCard", () => {
  it("recommends a later departure and re-plans for it", async () => {
    const user = userEvent.setup();
    respondWith([
      option(3, 0.4, "Severe miles 40.0 → 0.0"),
      option(0, 1.6, "Same risk profile as the planned departure"),
      option(1, 1.2, "Severe miles 40.0 → 20.0"),
    ]);
    submitFixtureTrip();
    renderWithProviders(<DepartureWindowCard />);

    expect(await screen.findByText("3 h later")).toBeInTheDocument();
    expect(screen.getByText("Severe miles 40.0 → 0.0")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Re-plan for/ }));

    expect(useTripDraftStore.getState().departure.getTime()).toBe(departure + 3 * HOUR);
  });

  it("confirms when leaving now is already best", async () => {
    respondWith([
      option(0, 0.2, "Same risk profile as the planned departure"),
      option(1, 0.5, "x"),
    ]);
    submitFixtureTrip();
    renderWithProviders(<DepartureWindowCard />);

    expect(await screen.findByText("Leaving now is already the safest")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Re-plan for/ })).not.toBeInTheDocument();
  });
});
