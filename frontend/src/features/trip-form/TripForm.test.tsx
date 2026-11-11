import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTripDraftStore } from "@/stores/tripDraftStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DALLAS_PLACE, DENVER_PLACE } from "@/test/server";
import { PlanTripBar } from "./PlanTripBar";
import { TripForm } from "./TripForm";

describe("TripForm", () => {
  it("shows inline errors when origin and destination are missing", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <TripForm />
        <PlanTripBar />
      </>,
    );

    await user.click(screen.getByRole("button", { name: /find safest route/i }));

    expect(screen.getByText("Choose an origin.")).toBeInTheDocument();
    expect(screen.getByText("Choose a destination.")).toBeInTheDocument();
    expect(useTripDraftStore.getState().submittedTrip).toBeNull();
  });

  it("submits a sample trip in one click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TripForm />);

    await user.click(screen.getByRole("button", { name: "Denver → Dallas" }));

    const submittedTrip = useTripDraftStore.getState().submittedTrip;
    expect(submittedTrip?.origin).toEqual(DENVER_PLACE);
    expect(submittedTrip?.destination).toEqual(DALLAS_PLACE);
    expect(submittedTrip?.request.load_pounds).toBe(42_000);
    expect(submittedTrip?.request.interval_miles).toBe(25);
  });

  it("explains load rules as the weight crosses thresholds", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TripForm />);

    await user.click(screen.getByRole("button", { name: "Empty" }));
    expect(screen.getByText("Standard thresholds.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Full 80k" }));
    expect(screen.getByText("Heavy load rules active.")).toBeInTheDocument();
    expect(useTripDraftStore.getState().loadPounds).toBe(80_000);
  });

  it("changes the sampling interval with arrow keys", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TripForm />);

    await user.click(screen.getByRole("radio", { name: "25 mi" }));
    await user.keyboard("{ArrowRight}");

    expect(useTripDraftStore.getState().intervalMiles).toBe(50);
    expect(screen.getByRole("radio", { name: "50 mi" })).toHaveFocus();
  });

  it("swaps origin and destination", async () => {
    const user = userEvent.setup();
    useTripDraftStore.setState({ origin: DENVER_PLACE, destination: DALLAS_PLACE });
    renderWithProviders(<TripForm />);

    await user.click(screen.getByRole("button", { name: "Swap origin and destination" }));

    expect(useTripDraftStore.getState().origin).toEqual(DALLAS_PLACE);
    expect(useTripDraftStore.getState().destination).toEqual(DENVER_PLACE);
  });
});
