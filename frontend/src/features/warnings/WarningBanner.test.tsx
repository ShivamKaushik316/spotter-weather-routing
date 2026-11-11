import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { tripPlan } from "@/test/server";
import { submitFixtureTrip } from "@/test/submitFixtureTrip";
import { WarningBanner } from "./WarningBanner";

describe("WarningBanner", () => {
  it("shows the first warning and expands to the rest", async () => {
    const user = userEvent.setup();
    submitFixtureTrip();
    renderWithProviders(<WarningBanner />);
    const [firstWarning, ...otherWarnings] = tripPlan.warnings;

    expect(await screen.findByText(firstWarning!)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `+${otherWarnings.length} more` }));

    for (const warning of otherWarnings) {
      expect(screen.getByText(warning)).toBeInTheDocument();
    }
  });

  it("can be dismissed for the current plan", async () => {
    const user = userEvent.setup();
    submitFixtureTrip();
    renderWithProviders(<WarningBanner />);

    await user.click(await screen.findByRole("button", { name: "Dismiss warnings" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
