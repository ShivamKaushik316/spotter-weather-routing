import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTimelineStore } from "@/stores/timelineStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import { submitFixtureTrip } from "@/test/submitFixtureTrip";
import { TimelineDock } from "./TimelineDock";

describe("TimelineDock", () => {
  it("disables playback until a trip is planned", () => {
    renderWithProviders(<TimelineDock />);

    expect(screen.getByRole("button", { name: "Play forecast playback" })).toBeDisabled();
  });

  it("moves the forecast hour with the scrubber", async () => {
    submitFixtureTrip();
    renderWithProviders(<TimelineDock />);
    const slider = screen.getByRole("slider", { name: "Forecast hour" });

    fireEvent.change(slider, { target: { value: "12" } });

    expect(useTimelineStore.getState().hour).toBe(12);
    await waitFor(() => expect(screen.getByText("+12.0 h")).toBeInTheDocument());
  });

  it("plays and pauses the forecast", async () => {
    const user = userEvent.setup();
    submitFixtureTrip();
    renderWithProviders(<TimelineDock />);

    await user.click(await screen.findByRole("button", { name: "Play forecast playback" }));
    await waitFor(() => expect(useTimelineStore.getState().hour).toBeGreaterThan(0));
    await user.click(screen.getByRole("button", { name: "Pause forecast playback" }));

    expect(useTimelineStore.getState().isPlaying).toBe(false);
  });

  it("switches playback speed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TimelineDock />);

    await user.click(screen.getByRole("button", { name: "8×" }));

    expect(useTimelineStore.getState().speed).toBe(8);
    expect(screen.getByRole("button", { name: "8×" })).toHaveAttribute("aria-pressed", "true");
  });
});
