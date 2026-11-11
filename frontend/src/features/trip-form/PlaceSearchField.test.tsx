import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Place } from "@/shared/api/types";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DENVER_PLACE } from "@/test/server";
import { PlaceSearchField } from "./PlaceSearchField";

function renderField(onSelect: (place: Place | null) => void) {
  return renderWithProviders(
    <PlaceSearchField
      endpoint="origin"
      label="Origin"
      value={null}
      onSelect={onSelect}
      isNextMapPick={false}
    />,
  );
}

describe("PlaceSearchField", () => {
  it("suggests places and selects one with the keyboard", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderField(onSelect);
    const combobox = screen.getByRole("combobox");

    await user.type(combobox, "den");
    const options = await screen.findAllByRole("option");
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");

    expect(options[0]).toHaveTextContent(DENVER_PLACE.label);
    expect(onSelect).toHaveBeenLastCalledWith(DENVER_PLACE);
    expect(combobox).toHaveValue(DENVER_PLACE.label);
    expect(combobox).toHaveAttribute("aria-expanded", "false");
  });

  it("selects a suggestion with the mouse", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderField(onSelect);

    await user.type(screen.getByRole("combobox"), "den");
    await user.click(await screen.findByRole("option", { name: "Denton, TX, USA" }));

    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: "Denton, TX, USA" }),
    );
  });

  it("does not search for a single character", async () => {
    const user = userEvent.setup();
    renderField(vi.fn());

    await user.type(screen.getByRole("combobox"), "d");

    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
