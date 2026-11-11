const MILLISECONDS_PER_HOUR = 3_600_000;
const MAJOR_TICK_EVERY_HOURS = 6;

export interface DayBoundary {
  hour: number;
  label: string;
}

export interface TimelineMarks {
  dayBoundaries: DayBoundary[];
  majorTickHours: number[];
}

function startOfNextLocalDay(moment: Date): Date {
  const nextDay = new Date(moment);
  nextDay.setHours(24, 0, 0, 0);
  return nextDay;
}

export function buildTimelineMarks(start: Date, totalHours: number): TimelineMarks {
  const startMilliseconds = start.getTime();
  const endMilliseconds = startMilliseconds + totalHours * MILLISECONDS_PER_HOUR;
  const dayBoundaries: DayBoundary[] = [];

  for (
    let midnight = startOfNextLocalDay(start);
    midnight.getTime() < endMilliseconds;
    midnight = startOfNextLocalDay(midnight)
  ) {
    dayBoundaries.push({
      hour: (midnight.getTime() - startMilliseconds) / MILLISECONDS_PER_HOUR,
      label: midnight.toLocaleDateString("en-US", { weekday: "short" }),
    });
  }

  const majorTickHours = Array.from(
    { length: Math.floor(totalHours / MAJOR_TICK_EVERY_HOURS) + 1 },
    (_, index) => index * MAJOR_TICK_EVERY_HOURS,
  );

  return { dayBoundaries, majorTickHours };
}
