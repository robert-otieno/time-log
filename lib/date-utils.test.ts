import { describe, expect, it } from "vitest";

import { formatISODate, formatISODateString, formatWeekRange } from "@/lib/date-utils";

describe("date utilities", () => {
  it("formats a local calendar date without converting timezones", () => {
    const localDate = new Date(2026, 0, 5, 23, 30);

    expect(formatISODate(localDate)).toBe("2026-01-05");
  });

  it("renders a date-only value without shifting the day", () => {
    expect(formatISODateString("2026-09-16", "en-US")).toBe("September 16, 2026");
  });

  it("rejects date strings outside the persisted YYYY-MM-DD shape", () => {
    expect(() => formatISODateString("09/16/2026")).toThrow('Expected date in "YYYY-MM-DD" format');
  });

  it("formats an inclusive seven-day week range", () => {
    const monday = new Date(2026, 8, 14, 12);

    expect(formatWeekRange(monday, "en-US")).toBe("Sep 14 - Sep 20");
  });
});
