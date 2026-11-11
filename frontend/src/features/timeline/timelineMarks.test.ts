import { buildTimelineMarks } from "./timelineMarks";

describe("buildTimelineMarks", () => {
  const departure = new Date(2026, 10, 10, 11, 0);
  const marks = buildTimelineMarks(departure, 48);

  it("marks each local midnight with the weekday", () => {
    expect(marks.dayBoundaries.map((boundary) => boundary.hour)).toEqual([13, 37]);
    expect(marks.dayBoundaries[0]?.label).toBe("Wed");
    expect(marks.dayBoundaries[1]?.label).toBe("Thu");
  });

  it("adds a major tick every six hours", () => {
    expect(marks.majorTickHours).toEqual([0, 6, 12, 18, 24, 30, 36, 42, 48]);
  });

  it("does not mark a midnight that falls exactly on departure", () => {
    const midnightDeparture = buildTimelineMarks(new Date(2026, 10, 11, 0, 0), 12);

    expect(midnightDeparture.dayBoundaries).toEqual([]);
  });
});
