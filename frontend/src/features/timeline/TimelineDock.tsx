import { useMemo } from "react";
import { corridorHeatByHour } from "@/entities/risk";
import { useCorridorHeatmap, useTripPlan } from "@/entities/trip";
import { cn } from "@/shared/lib/cn";
import { Panel } from "@/shared/ui/Panel";
import { PauseIcon, PlayIcon } from "@/shared/ui/icons";
import { PLAYBACK_SPEEDS, useTimelineStore } from "@/stores/timelineStore";
import { useTripDraftStore } from "@/stores/tripDraftStore";
import { Legend } from "./Legend";
import { Scrubber } from "./Scrubber";
import { TimelineClock } from "./TimelineClock";
import { usePlayback } from "./usePlayback";

export function TimelineDock() {
  const { data: plan } = useTripPlan();
  const draftDeparture = useTripDraftStore((state) => state.departure);
  const isPlaying = useTimelineStore((state) => state.isPlaying);
  const speed = useTimelineStore((state) => state.speed);
  const togglePlaying = useTimelineStore((state) => state.togglePlaying);
  const setSpeed = useTimelineStore((state) => state.setSpeed);
  const departure = useMemo(
    () => (plan ? new Date(plan.departure) : draftDeparture),
    [plan, draftDeparture],
  );
  const { data: heatmap } = useCorridorHeatmap(plan);
  const hourlyHeat = useMemo(() => (heatmap ? corridorHeatByHour(heatmap) : null), [heatmap]);

  usePlayback();

  return (
    <Panel
      as="footer"
      aria-label="Forecast timeline"
      className="dock absolute bottom-4 left-4 right-4 flex h-[108px] items-center gap-[18px] px-5"
    >
      <button
        type="button"
        onClick={togglePlaying}
        disabled={!plan}
        aria-label={isPlaying ? "Pause forecast playback" : "Play forecast playback"}
        aria-keyshortcuts="Space"
        className="grid size-12 flex-none place-items-center rounded-full bg-accent text-accent-ink shadow-[0_0_0_6px_var(--color-accent-soft)] transition active:scale-95 disabled:opacity-40"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="w-36 flex-none max-[960px]:w-28">
        <TimelineClock departure={departure} />
        <div className="mt-1.5 flex gap-0.5" role="group" aria-label="Playback speed">
          {PLAYBACK_SPEEDS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={speed === option}
              onClick={() => setSpeed(option)}
              className={cn(
                "rounded-[5px] border px-1.5 py-px font-mono text-[10px]",
                speed === option ? "border-accent text-accent" : "border-line text-muted",
              )}
            >
              {option}×
            </button>
          ))}
        </div>
      </div>

      <Scrubber departure={departure} hourlyHeat={hourlyHeat} />
      <Legend />
    </Panel>
  );
}
