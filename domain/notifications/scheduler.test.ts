import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { localParts, timedReminderDue } from "@/domain/notifications/scheduler";

describe("scheduled notification timing", () => {
  it("evaluates digest hours in the recipient timezone", () => {
    expect(
      localParts(new Date("2026-09-21T15:30:00.000Z"), "America/Los_Angeles"),
    ).toMatchObject({
      weekday: "Mon",
      hour: "08",
      year: "2026",
      month: "09",
      day: "21",
    });
  });

  it("selects timed reminders across the persisted catch-up and next-day window", () => {
    const dueAt = {
      seconds: Date.parse("2026-09-22T16:00:00.000Z") / 1000,
      nanoseconds: 0,
    };
    const start = new Date("2026-09-20T16:00:00.000Z");
    expect(
      timedReminderDue(dueAt, start, new Date("2026-09-21T16:00:00.000Z")),
    ).toBe(true);
    expect(
      timedReminderDue(dueAt, start, new Date("2026-09-21T15:59:59.000Z")),
    ).toBe(false);

    const recentlyDue = {
      seconds: Date.parse("2026-09-21T16:30:00.000Z") / 1000,
      nanoseconds: 0,
    };
    expect(
      timedReminderDue(
        recentlyDue,
        start,
        new Date("2026-09-21T16:59:00.000Z"),
      ),
    ).toBe(true);
    expect(
      timedReminderDue(
        recentlyDue,
        new Date("2026-09-21T16:30:00.000Z"),
        new Date("2026-09-21T16:59:00.000Z"),
      ),
    ).toBe(false);
  });
});
