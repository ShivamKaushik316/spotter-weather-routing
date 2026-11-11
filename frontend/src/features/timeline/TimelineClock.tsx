import { useCallback, useRef } from "react";
import { formatClock, formatHourOffset } from "@/shared/lib/format";
import { useTimelineHourEffect } from "@/stores/useTimelineHourEffect";

const MILLISECONDS_PER_HOUR = 3_600_000;

export function TimelineClock({ departure }: { departure: Date }) {
  const clockRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<HTMLDivElement>(null);

  const renderHour = useCallback(
    (hour: number) => {
      if (clockRef.current) {
        clockRef.current.textContent = formatClock(
          new Date(departure.getTime() + hour * MILLISECONDS_PER_HOUR),
        );
      }
      if (offsetRef.current) offsetRef.current.textContent = formatHourOffset(hour);
    },
    [departure],
  );

  useTimelineHourEffect(renderHour);

  return (
    <div>
      <div
        ref={clockRef}
        className="whitespace-nowrap font-mono text-[22px] font-semibold leading-tight tracking-tight max-[960px]:text-lg"
      />
      <div ref={offsetRef} className="font-mono text-xs text-muted" />
    </div>
  );
}
