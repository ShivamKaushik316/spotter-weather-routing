import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSelectionStore } from "@/stores/selectionStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import { tripPlan } from "@/test/server";
import { submitFixtureTrip } from "@/test/submitFixtureTrip";
import { CheckpointDrawer } from "./CheckpointDrawer";

const riskiestCheckpoint = tripPlan.routes
  .flatMap((route) => route.checkpoints.map((checkpoint) => ({ route, checkpoint })))
  .reduce((riskiest, candidate) =>
    (candidate.checkpoint.risk_score ?? -1) > (riskiest.checkpoint.risk_score ?? -1)
      ? candidate
      : riskiest,
  );

describe("CheckpointDrawer", () => {
  it("is empty until a checkpoint is selected", () => {
    renderWithProviders(<CheckpointDrawer />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("explains the weather and risk at the selected checkpoint", async () => {
    submitFixtureTrip();
    useSelectionStore.getState().selectCheckpoint({
      routeId: riskiestCheckpoint.route.route_id,
      sequence: riskiestCheckpoint.checkpoint.sequence,
    });
    renderWithProviders(<CheckpointDrawer />);

    expect(
      await screen.findByRole("heading", {
        name: `Route ${riskiestCheckpoint.route.route_id} · Checkpoint ${riskiestCheckpoint.checkpoint.sequence + 1}`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(riskiestCheckpoint.checkpoint.risk_level ?? "Unknown"),
    ).toBeInTheDocument();
    expect(screen.getByText("Wind")).toBeInTheDocument();
    for (const reason of riskiestCheckpoint.checkpoint.risk_reasons) {
      expect(screen.getByText(reason)).toBeInTheDocument();
    }
  });

  it("closes from the close button", async () => {
    const user = userEvent.setup();
    submitFixtureTrip();
    useSelectionStore.getState().selectCheckpoint({
      routeId: riskiestCheckpoint.route.route_id,
      sequence: riskiestCheckpoint.checkpoint.sequence,
    });
    renderWithProviders(<CheckpointDrawer />);

    await user.click(await screen.findByRole("button", { name: "Close checkpoint details" }));

    expect(useSelectionStore.getState().selectedCheckpoint).toBeNull();
  });
});
