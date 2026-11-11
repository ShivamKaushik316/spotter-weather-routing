import { FORECAST_HOURS, useTimelineStore } from "./timelineStore";

describe("timelineStore", () => {
  it("clamps the hour to the forecast range", () => {
    useTimelineStore.getState().setHour(72);
    expect(useTimelineStore.getState().hour).toBe(FORECAST_HOURS);

    useTimelineStore.getState().setHour(-3);
    expect(useTimelineStore.getState().hour).toBe(0);
  });

  it("steps to whole hours in either direction", () => {
    useTimelineStore.getState().setHour(3.4);

    useTimelineStore.getState().stepHour(1);
    expect(useTimelineStore.getState().hour).toBe(4);

    useTimelineStore.getState().setHour(3.4);
    useTimelineStore.getState().stepHour(-1);
    expect(useTimelineStore.getState().hour).toBe(3);
  });

  it("restarts from zero when playing after reaching the end", () => {
    useTimelineStore.getState().setHour(FORECAST_HOURS);

    useTimelineStore.getState().togglePlaying();

    expect(useTimelineStore.getState()).toMatchObject({ isPlaying: true, hour: 0 });
  });
});
