import { useEffect, useRef } from "react";
import { rafThrottle } from "@/shared/lib/rafThrottle";
import { useTimelineStore } from "./timelineStore";

export function useTimelineHourEffect(onHourChange: (hour: number) => void): void {
  const callbackRef = useRef(onHourChange);

  useEffect(() => {
    callbackRef.current = onHourChange;
    onHourChange(useTimelineStore.getState().hour);
  }, [onHourChange]);

  useEffect(() => {
    const throttledRender = rafThrottle((hour: number) => {
      callbackRef.current(hour);
    });
    const unsubscribe = useTimelineStore.subscribe((state, previousState) => {
      if (state.hour !== previousState.hour) throttledRender(state.hour);
    });
    return () => {
      unsubscribe();
      throttledRender.cancel();
    };
  }, []);
}
