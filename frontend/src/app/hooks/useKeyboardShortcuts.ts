import { useEffect } from "react";
import { useSelectionStore } from "@/stores/selectionStore";
import { useTimelineStore } from "@/stores/timelineStore";

const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, canvas, [role='radio'], [role='combobox'], [contenteditable='true']";

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
}

export function useKeyboardShortcuts(isTimelineEnabled: boolean): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape") {
        useSelectionStore.getState().closeCheckpoint();
        return;
      }
      if (!isTimelineEnabled || isInteractiveTarget(event.target)) return;
      const timeline = useTimelineStore.getState();
      if (event.key === " ") {
        event.preventDefault();
        timeline.togglePlaying();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        timeline.stepHour(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        timeline.stepHour(-1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTimelineEnabled]);
}
