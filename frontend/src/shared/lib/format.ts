const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

export function formatMiles(miles: number, fractionDigits = 0): string {
  return miles.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatPounds(pounds: number): string {
  return Math.round(pounds).toLocaleString("en-US");
}

export function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function formatRiskScore(score: number | null): string {
  return score === null ? "—" : score.toFixed(2);
}

export function formatHourOffset(hours: number): string {
  return `+${hours.toFixed(1)} h`;
}

export function formatClock(moment: Date): string {
  const weekday = moment.toLocaleDateString("en-US", { weekday: "short" });
  const time = moment.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${weekday} ${time}`;
}

export function formatDateTime(moment: Date): string {
  const date = moment.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${date} · ${formatClock(moment).split(" ")[1] ?? ""}`;
}

export function formatTimeZoneName(moment: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(moment);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
}

export function toDateTimeInputValue(moment: Date): string {
  const localMoment = new Date(
    moment.getTime() - moment.getTimezoneOffset() * MILLISECONDS_PER_MINUTE,
  );
  return localMoment.toISOString().slice(0, 16);
}

export function fromDateTimeInputValue(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function nextWholeHour(now: Date = new Date()): Date {
  const upcoming = new Date(now);
  upcoming.setMinutes(0, 0, 0);
  upcoming.setHours(upcoming.getHours() + 1);
  return upcoming;
}
