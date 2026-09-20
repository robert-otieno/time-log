import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { legacyDestinationId, mapLegacyRecords } from "@/domain/tasks/migration";

describe("legacy task migration mapping", () => {
  it("uses stable destination IDs for safe retries", () => {
    expect(legacyDestinationId("u1", "daily_tasks", "source-1")).toBe(legacyDestinationId("u1", "daily_tasks", "source-1"));
    expect(legacyDestinationId("u1", "daily_tasks", "source-1")).not.toBe(legacyDestinationId("u1", "daily_subtasks", "source-1"));
  });

  it("maps supported fields, nesting, and reports unmapped values", () => {
    const result = mapLegacyRecords("u1", [{ id: "parent", data: { title: "Plan", date: "2026-09-18", done: true, notes: "Details", tag: "work", reminderTime: "09:00" } }], [{ id: "child", data: { taskId: "parent", title: "Draft", done: false } }], "UTC");
    expect(result.mapped[0]).toMatchObject({ title: "Plan", description: "Details", status: "done", dueDate: "2026-09-18", dueAt: null, parentTaskId: null });
    expect(result.mapped[1]).toMatchObject({ title: "Draft", status: "todo", parentTaskId: result.mapped[0].id });
    expect(result.preview.unmappedFields).toEqual({ tag: 1, reminderTime: 1 });
  });

  it("skips malformed tasks and orphaned subtasks without exposing source values", () => {
    const result = mapLegacyRecords("u1", [{ id: "bad", data: { title: "", date: "not-a-date", done: false } }], [{ id: "orphan", data: { taskId: "missing", title: "Child", done: false } }], "UTC");
    expect(result.mapped).toEqual([]);
    expect(result.preview.issues).toEqual([{ collection: "daily_tasks", sourceId: "bad", reason: "Invalid task fields" }, { collection: "daily_subtasks", sourceId: "orphan", reason: "Parent task is unavailable" }]);
  });
});
