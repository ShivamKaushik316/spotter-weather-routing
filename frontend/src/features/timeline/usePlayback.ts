import { useEffect } from "react";
import { FORECAST_HOURS, useTimelineStore } from "@/stores/timelineStore";

const MILLISECONDS_PER_SECOND = 1000;

export function usePlayback(): void {
  const isPlaying = useTimelineStore((state) => state.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;
    let animationFrame = 0;
    let previousTimestamp: number | null = null;

    const advance = (timestamp: number) => {
      const { hour, speed, setHour, stop } = useTimelineStore.getState();
      if (previousTimestamp !== null) {
        const elapsedSeconds = (timestamp - previousTimestamp) / MILLISECONDS_PER_SECOND;
        const nextHour = hour + elapsedSeconds * speed;
        if (nextHour >= FORECAST_HOURS) {
          setHour(FORECAST_HOURS);
          stop();
          return;
        }
        setHour(nextHour);
      }
      previousTimestamp = timestamp;
      animationFrame = requestAnimationFrame(advance);
    };

    animationFrame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying]);
}
