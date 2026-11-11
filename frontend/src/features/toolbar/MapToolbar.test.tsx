import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useThemeStore } from "@/shared/theme/themeStore";
import { useBasemapStore } from "@/stores/basemapStore";
import { useLayerStore } from "@/stores/layerStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MapToolbar } from "./MapToolbar";

describe("MapToolbar", () => {
  it("toggles map layers", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MapToolbar />);
    const heatmapToggle = screen.getByRole("button", { name: "Heatmap" });

    await user.click(heatmapToggle);

    expect(useLayerStore.getState().visibility.heatmap).toBe(false);
    expect(heatmapToggle).toHaveAttribute("aria-pressed", "false");
  });

  it("switches between map and satellite basemaps", async () => {
    const user = userEvent.setup();
    useBasemapStore.setState({ basemap: "streets" });
    renderWithProviders(<MapToolbar />);

    await user.click(screen.getByRole("radio", { name: "Satellite" }));

    expect(useBasemapStore.getState().basemap).toBe("satellite");
    expect(screen.getByRole("radio", { name: "Satellite" })).toBeChecked();
  });

  it("toggles the colour theme", async () => {
    const user = userEvent.setup();
    useThemeStore.setState({ theme: "dark" });
    renderWithProviders(<MapToolbar />);

    await user.click(screen.getByRole("button", { name: "Switch to light theme" }));

    expect(useThemeStore.getState().theme).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
  });
});
