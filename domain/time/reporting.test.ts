import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { clientSafeReportCsv, defaultWeekDates, filterTimeEntries, summarizeTimeRows, timeReportFiltersSchema, zonedDateBoundary, type TimeReportRow } from "@/domain/time/reporting";
import type { TimeEntry } from "@/domain/time/schemas";

const filters = timeReportFiltersSchema.parse({ startDate: "2026-09-14", endDate: "2026-09-20", billable: "all", reportingStatus: "all" });
const entry = (overrides: Partial<TimeEntry> = {}): TimeEntry => {
  const startedAt = Timestamp.fromDate(new Date("2026-09-20T16:00:00Z"));
  const endedAt = Timestamp.fromDate(new Date("2026-09-20T17:00:00Z"));
  return { id: "e1", organizationId: "o1", projectId: "p1", taskId: "t1", userId: "u1", source: "timer", startedAt, endedAt, durationSeconds: 3600, note: null, billable: false, clientReportingStatus: "internal", correctionCount: 0, createdBy: "u1", createdAt: Timestamp.now(), updatedBy: "u1", updatedAt: Timestamp.now(), ...overrides, segments: overrides.segments ?? [{ startedAt, endedAt }] };
};

describe("time reporting", () => {
  it("derives Monday-through-Sunday defaults in the selected timezone", () => {
    expect(defaultWeekDates(new Date("2026-09-20T05:00:00Z"), "America/Los_Angeles")).toEqual({ startDate: "2026-09-14", endDate: "2026-09-20" });
  });

  it("converts local report dates across daylight-saving boundaries", () => {
    expect(zonedDateBoundary("2026-03-08", "America/Los_Angeles").toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(zonedDateBoundary("2026-03-08", "America/Los_Angeles", true).toISOString()).toBe("2026-03-09T07:00:00.000Z");
  });

  it("forces member and client-safe scopes before presentation", () => {
    const entries = [entry(), entry({ id: "e2", userId: "u2", clientReportingStatus: "approved", billable: true }), entry({ id: "e3", clientReportingStatus: "approved" })];
    expect(filterTimeEntries(entries, filters, "u1").map(({ id }) => id)).toEqual(["e1", "e3"]);
    expect(filterTimeEntries(entries, filters, undefined, true).map(({ id }) => id)).toEqual(["e2", "e3"]);
  });

  it("summarizes and exports only the supplied safe projection with CSV escaping", () => {
    const rows: TimeReportRow[] = [{ id: "e1", projectId: "p1", projectName: "Site", taskId: "t1", taskTitle: "Draft, review", userId: "u1", userName: "Casey \"C\"", startedAt: "2026-09-20T16:00:00.000Z", durationSeconds: 5400, billable: true, reportingStatus: "approved" }];
    expect(summarizeTimeRows(rows)).toEqual({ seconds: 5400, billableSeconds: 5400, entries: 1 });
    const csv = clientSafeReportCsv(rows, "America/Los_Angeles");
    expect(csv).toContain('"Casey ""C"""');
    expect(csv).toContain('"Draft, review"');
    expect(csv).not.toContain("Internal");
  });

  it("neutralizes spreadsheet formulas in exported user-controlled text", () => {
    const row: TimeReportRow = { id: "e1", projectId: "p1", projectName: "Site", taskId: "t1", taskTitle: "=WEBSERVICE(\"https://example.test\")", userId: "u1", userName: " +SUM(1,1)", startedAt: "2026-09-20T16:00:00.000Z", durationSeconds: 60, billable: false, reportingStatus: "approved" };
    const csv = clientSafeReportCsv([row], "UTC");
    expect(csv).toContain("' +SUM(1,1)");
    expect(csv).toContain("'=WEBSERVICE");
  });

  it("rejects reversed and excessive ranges", () => {
    expect(timeReportFiltersSchema.safeParse({ startDate: "2026-09-20", endDate: "2026-09-19", billable: "all", reportingStatus: "all" }).success).toBe(false);
    expect(timeReportFiltersSchema.safeParse({ startDate: "2025-01-01", endDate: "2026-09-20", billable: "all", reportingStatus: "all" }).success).toBe(false);
  });
});
