import { renderHook } from "@testing-library/react";
import { useSelectionStore } from "@/stores/selectionStore";
import { useTimelineStore } from "@/stores/timelineStore";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

const press = (key: string, target: EventTarget = document.body) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

describe("useKeyboardShortcuts", () => {
  it("controls the timeline when a plan exists", () => {
    renderHook(() => useKeyboardShortcuts(true));

    press("ArrowRight");
    press("ArrowRight");
    press("ArrowLeft");
    press(" ");

    expect(useTimelineStore.getState()).toMatchObject({ hour: 1, isPlaying: true });
  });

  it("ignores timeline keys while typing in a field", () => {
    renderHook(() => useKeyboardShortcuts(true));
    const input = document.createElement("input");
    document.body.append(input);

    press("ArrowRight", input);

    expect(useTimelineStore.getState().hour).toBe(0);
    input.remove();
  });

  it("closes the checkpoint drawer with Escape even without a plan", () => {
    useSelectionStore.getState().selectCheckpoint({ routeId: "A", sequence: 1 });
    renderHook(() => useKeyboardShortcuts(false));

    press("Escape");
    press("ArrowRight");

    expect(useSelectionStore.getState().selectedCheckpoint).toBeNull();
    expect(useTimelineStore.getState().hour).toBe(0);
  });
});
