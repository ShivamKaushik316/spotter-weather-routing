import { useCallback, useId, useMemo, useRef } from "react";
import { heatTimelineGradient } from "@/entities/risk";
import { cn } from "@/shared/lib/cn";
import { formatClock, formatHourOffset } from "@/shared/lib/format";
import { FORECAST_HOURS, useTimelineStore } from "@/stores/timelineStore";
import { useTimelineHourEffect } from "@/stores/useTimelineHourEffect";
import { buildTimelineMarks } from "./timelineMarks";

const MILLISECONDS_PER_HOUR = 3_600_000;
const SLIDER_STEP_HOURS = 0.05;
const LABELLED_TICK_EVERY_HOURS = 12;

const toPercent = (hour: number) => `${(hour / FORECAST_HOURS) * 100}%`;

interface ScrubberProps {
  departure: Date;
  hourlyHeat: readonly number[] | null;
}

export function Scrubber({ departure, hourlyHeat }: ScrubberProps) {
  const descriptionId = useId();
  const marks = useMemo(() => buildTimelineMarks(departure, FORECAST_HOURS), [departure]);
  const trackBackground = useMemo(
    () => (hourlyHeat && hourlyHeat.length > 0 ? heatTimelineGradient(hourlyHeat) : undefined),
    [hourlyHeat],
  );
  const setHour = useTimelineStore((state) => state.setHour);
  const thumbRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const renderHour = useCallback(
    (hour: number) => {
      if (thumbRef.current) thumbRef.current.style.left = toPercent(hour);
      if (inputRef.current) {
        inputRef.current.value = String(hour);
        inputRef.current.setAttribute(
          "aria-valuetext",
          `${formatClock(new Date(departure.getTime() + hour * MILLISECONDS_PER_HOUR))}, ${formatHourOffset(hour)} after departure`,
        );
      }
    },
    [departure],
  );

  useTimelineHourEffect(renderHour);

  return (
    <div className="relative h-16 min-w-0 flex-1">
      <p id={descriptionId} className="sr-only">
        The slider track is coloured by the weather along the route corridor for each hour, from
        grey for calm to magenta for extreme.
      </p>
      <div
        aria-hidden="true"
        title="Corridor weather by hour: grey is calm, magenta is extreme"
        className={cn(
          "absolute inset-x-0 top-[22px] h-5 overflow-hidden rounded-md border border-line",
          !trackBackground && "bg-raised",
        )}
        style={trackBackground ? { backgroundImage: trackBackground } : undefined}
      />

      {marks.majorTickHours.map((hour) => (
        <div key={hour} aria-hidden="true">
          <div
            className="absolute top-[22px] h-5 w-px bg-line-strong opacity-60"
            style={{ left: toPercent(hour) }}
          />
          <div
            className={cn(
              "absolute top-[46px] -translate-x-1/2 font-mono text-[10px] text-muted",
              hour % LABELLED_TICK_EVERY_HOURS !== 0 && "minor-tick-label",
            )}
            style={{ left: toPercent(hour) }}
          >
            +{hour}h
          </div>
        </div>
      ))}

      {marks.dayBoundaries.map((boundary) => (
        <div key={boundary.hour} aria-hidden="true">
          <div
            className="absolute bottom-[18px] top-0.5 w-px bg-line-strong"
            style={{ left: toPercent(boundary.hour) }}
          />
          <div
            className="absolute top-0.5 translate-x-1 text-[11px] font-semibold text-muted"
            style={{ left: toPercent(boundary.hour) }}
          >
            {boundary.label}
          </div>
        </div>
      ))}

      <input
        ref={inputRef}
        type="range"
        min={0}
        max={FORECAST_HOURS}
        step={SLIDER_STEP_HOURS}
        defaultValue={0}
        aria-label="Forecast hour"
        aria-describedby={descriptionId}
        onChange={(event) => setHour(Number(event.target.value))}
        className="scrubber-input absolute inset-x-0 top-[18px] h-7 w-full cursor-grab opacity-0 active:cursor-grabbing"
      />
      <div
        ref={thumbRef}
        aria-hidden="true"
        className="scrubber-thumb pointer-events-none absolute top-[14px] -ml-[9px] h-9 w-[18px] rounded-md bg-accent"
      />
    </div>
  );
}
