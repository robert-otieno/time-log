import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { dashboardRange, updateWorkTargetSchema } from "@/domain/work-dashboard/service";

describe("work dashboard", () => {
  it("uses organization-local day boundaries across daylight saving time", () => {
    const range = dashboardRange("today", "America/Los_Angeles", new Date("2026-03-08T20:00:00.000Z"));
    expect(range.start.toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-03-09T07:00:00.000Z");
  });

  it("starts weekly summaries on Monday and month summaries on day one", () => {
    const now = new Date("2026-09-23T18:00:00.000Z");
    expect(dashboardRange("week", "UTC", now).start.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(dashboardRange("month", "UTC", now).start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("validates personal targets and requires a working day", () => {
    expect(updateWorkTargetSchema.safeParse({ dailyTargetMinutes: 480, workingDays: ["mon", "tue"] }).success).toBe(true);
    expect(updateWorkTargetSchema.safeParse({ dailyTargetMinutes: 10, workingDays: [] }).success).toBe(false);
  });
});
