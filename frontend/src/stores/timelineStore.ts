import { create } from "zustand";

export const FORECAST_HOURS = 48;
export const PLAYBACK_SPEEDS = [1, 4, 8] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

interface TimelineState {
  hour: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  setHour: (hour: number) => void;
  stepHour: (direction: 1 | -1) => void;
  togglePlaying: () => void;
  stop: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  reset: () => void;
}

const clampHour = (hour: number) => Math.min(Math.max(hour, 0), FORECAST_HOURS);

export const useTimelineStore = create<TimelineState>()((set, get) => ({
  hour: 0,
  isPlaying: false,
  speed: 1,
  setHour: (hour) => set({ hour: clampHour(hour) }),
  stepHour: (direction) => {
    const currentHour = get().hour;
    const steppedHour = direction > 0 ? Math.floor(currentHour) + 1 : Math.ceil(currentHour) - 1;
    set({ hour: clampHour(steppedHour) });
  },
  togglePlaying: () =>
    set((state) => ({
      isPlaying: !state.isPlaying,
      hour: !state.isPlaying && state.hour >= FORECAST_HOURS ? 0 : state.hour,
    })),
  stop: () => set({ isPlaying: false }),
  setSpeed: (speed) => set({ speed }),
  reset: () => set({ hour: 0, isPlaying: false }),
}));
