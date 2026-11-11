import {
  formatDuration,
  formatHourOffset,
  formatMiles,
  formatPounds,
  formatRiskScore,
  fromDateTimeInputValue,
  nextWholeHour,
  toDateTimeInputValue,
} from "./format";

describe("format", () => {
  it("formats miles with fixed precision", () => {
    expect(formatMiles(1234.567)).toBe("1,235");
    expect(formatMiles(12.5, 1)).toBe("12.5");
  });

  it("formats load weight in pounds", () => {
    expect(formatPounds(42000.4)).toBe("42,000");
  });

  it("formats durations as hours and zero-padded minutes", () => {
    expect(formatDuration(51_840)).toBe("14h 24m");
    expect(formatDuration(300)).toBe("0h 05m");
  });

  it("shows a dash for unknown risk scores", () => {
    expect(formatRiskScore(null)).toBe("—");
    expect(formatRiskScore(0.4237)).toBe("0.42");
  });

  it("formats hour offsets", () => {
    expect(formatHourOffset(3.25)).toBe("+3.3 h");
  });

  it("round-trips datetime-local input values", () => {
    const moment = new Date(2026, 10, 12, 6, 30);

    const inputValue = toDateTimeInputValue(moment);

    expect(inputValue).toBe("2026-11-12T06:30");
    expect(fromDateTimeInputValue(inputValue)?.getTime()).toBe(moment.getTime());
    expect(fromDateTimeInputValue("not a date")).toBeNull();
  });

  it("rounds up to the next whole hour", () => {
    const upcoming = nextWholeHour(new Date(2026, 10, 12, 6, 30, 45));

    expect(upcoming).toEqual(new Date(2026, 10, 12, 7, 0, 0));
  });
});
