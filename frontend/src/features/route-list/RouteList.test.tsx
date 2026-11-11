import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useSelectionStore } from "@/stores/selectionStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import { API_BASE_URL, server, tripPlan } from "@/test/server";
import { submitFixtureTrip } from "@/test/submitFixtureTrip";
import { RouteList } from "./RouteList";

describe("RouteList", () => {
  it("invites the user to plan a trip before anything is submitted", () => {
    renderWithProviders(<RouteList />);

    expect(screen.getByText("No trip planned yet")).toBeInTheDocument();
  });

  it("renders ranked routes with the recommendation first", async () => {
    submitFixtureTrip();
    renderWithProviders(<RouteList />);

    const routeButtons = await screen.findAllByRole("button", { name: /^Route [A-C], rank/ });

    expect(routeButtons).toHaveLength(tripPlan.routes.length);
    expect(routeButtons[0]).toHaveAccessibleName(
      `Route ${tripPlan.recommended_route_id}, rank 1, recommended`,
    );
    expect(within(routeButtons[0]!).getByText("Recommended")).toBeInTheDocument();
    expect(within(routeButtons[0]!).getByText(tripPlan.recommendation_reason)).toBeInTheDocument();
  });

  it("syncs hover and selection with the map store", async () => {
    const user = userEvent.setup();
    submitFixtureTrip();
    renderWithProviders(<RouteList />);
    const secondRoute = tripPlan.routes[1]!;
    const secondRouteButton = await screen.findByRole("button", {
      name: new RegExp(`^Route ${secondRoute.route_id}, rank 2`),
    });

    await user.hover(secondRouteButton);
    expect(useSelectionStore.getState().hoveredRouteId).toBe(secondRoute.route_id);

    await user.click(secondRouteButton);
    expect(useSelectionStore.getState().selectedRouteId).toBe(secondRoute.route_id);
    expect(secondRouteButton).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the backend error message with its request id", async () => {
    server.use(
      http.post(`${API_BASE_URL}/api/trips/plan`, () =>
        HttpResponse.json(
          { error: { code: "no_route_found", message: "No drivable route was found." } },
          { status: 422, headers: { "X-Request-ID": "req-42" } },
        ),
      ),
    );
    submitFixtureTrip();
    renderWithProviders(<RouteList />);

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("Could not plan this trip");
    expect(alert).toHaveTextContent("No drivable route was found.");
    expect(alert).toHaveTextContent("request req-42");
  });
});
