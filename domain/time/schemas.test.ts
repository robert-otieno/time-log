import { describe, expect, it } from "vitest";
import { activeTimerSchema, correctTimeEntryCommandSchema, startTimerCommandSchema, stopTimerCommandSchema } from "@/domain/time/schemas";

const timestamp = { seconds: 10, nanoseconds: 0 };

describe("active timer schemas", () => {
  it("accepts a task timer and normalizes omitted optional input", () => {
    expect(startTimerCommandSchema.parse({})).toEqual({ taskId: null, note: null });
    expect(activeTimerSchema.parse({ userId: "u1", organizationId: "o1", projectId: "p1", taskId: "t1", startedAt: timestamp, note: null })).toMatchObject({ taskId: "t1" });
  });

  it("rejects unknown fields and oversized notes", () => {
    expect(() => startTimerCommandSchema.parse({ unexpected: true })).toThrow();
    expect(() => startTimerCommandSchema.parse({ taskId: "t1", note: "x".repeat(2001) })).toThrow();
  });

  it("defaults task completion off when stopping a timer", () => {
    expect(stopTimerCommandSchema.parse({})).toMatchObject({ completeTask: false, billable: false, clientReportingStatus: "internal" });
    expect(stopTimerCommandSchema.parse({ completeTask: true })).toMatchObject({ completeTask: true });
  });

  it("accepts a partial correction and rejects an empty correction", () => {
    expect(correctTimeEntryCommandSchema.parse({ entryId: "entry-1", billable: true })).toEqual({ entryId: "entry-1", billable: true });
    expect(() => correctTimeEntryCommandSchema.parse({ entryId: "entry-1" })).toThrow();
  });
});
