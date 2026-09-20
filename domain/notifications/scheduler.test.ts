import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { localParts, timedReminderDue } from "@/domain/notifications/scheduler";

describe("scheduled notification timing", () => {
  it("evaluates digest hours in the recipient timezone", () => {
    expect(localParts(new Date("2026-09-21T15:30:00.000Z"), "America/Los_Angeles")).toMatchObject({ weekday: "Mon", hour: "08", year: "2026", month: "09", day: "21" });
  });

  it("selects a timed reminder during the hour after its 24-hour threshold", () => {
    const dueAt = { seconds: Date.parse("2026-09-22T16:00:00.000Z") / 1000, nanoseconds: 0 };
    expect(timedReminderDue(dueAt, new Date("2026-09-21T16:30:00.000Z"))).toBe(true);
    expect(timedReminderDue(dueAt, new Date("2026-09-21T15:59:59.000Z"))).toBe(false);
    expect(timedReminderDue(dueAt, new Date("2026-09-21T17:00:01.000Z"))).toBe(false);
  });
});
