import { describe, expect, it } from "vitest";
import { createTaskCommandSchema, projectTaskSchema, taskQuerySchema } from "@/domain/tasks/schemas";

const timestamp = { seconds: 1, nanoseconds: 0 };
const task = { id: "t1", projectId: "p1", title: "Draft", description: null, assigneeIds: ["u1"], status: "todo", priority: "high", dueDate: null, dueAt: null, dueTimeSet: false, visibility: "internal", parentTaskId: null, boardColumnId: null, sortOrder: 1, completedAt: null, archivedAt: null, createdBy: "u1", createdAt: timestamp, updatedBy: "u1", updatedAt: timestamp };

describe("project task schemas", () => {
  it("parses the canonical task document", () => expect(projectTaskSchema.parse(task)).toEqual(task));
  it("requires completion timestamps to agree with status", () => {
    expect(() => projectTaskSchema.parse({ ...task, status: "done" })).toThrow();
    expect(projectTaskSchema.parse({ ...task, status: "done", completedAt: timestamp }).status).toBe("done");
  });
  it("rejects self-parenting", () => expect(() => projectTaskSchema.parse({ ...task, parentTaskId: "t1" })).toThrow());
  it("normalizes duplicate assignees and validates offset deadlines", () => {
    const parsed = createTaskCommandSchema.parse({ title: "Draft", description: null, assigneeIds: ["u1", "u1"], priority: "medium", dueDate: "2026-09-18", dueAt: "2026-09-18T17:00:00-07:00", dueTimeSet: true, visibility: "internal", parentTaskId: null, boardColumnId: null, sortOrder: 0 });
    expect(parsed.assigneeIds).toEqual(["u1"]);
    expect(() => createTaskCommandSchema.parse({ ...parsed, dueAt: "2026-09-18" })).toThrow();
  });
  it("keeps date-only deadlines free of timezone-bearing timestamps", () => {
    const parsed = createTaskCommandSchema.parse({ title: "Draft", description: null, assigneeIds: [], priority: "medium", dueDate: "2026-09-18", dueAt: null, dueTimeSet: false, visibility: "internal", parentTaskId: null, boardColumnId: null, sortOrder: 0 });
    expect(parsed).toMatchObject({ dueDate: "2026-09-18", dueAt: null, dueTimeSet: false });
    expect(() => createTaskCommandSchema.parse({ ...parsed, dueAt: "2026-09-18T17:00:00-07:00" })).toThrow();
  });
  it("defaults new tasks to internal visibility", () => {
    const { visibility: _, ...withoutVisibility } = { title: "Draft", description: null, assigneeIds: [], priority: "medium" as const, dueAt: null, visibility: "internal" as const, parentTaskId: null, boardColumnId: null, sortOrder: 0 }; void _;
    expect(createTaskCommandSchema.parse(withoutVisibility).visibility).toBe("internal");
  });
  it("bounds repository queries", () => expect(() => taskQuerySchema.parse({ limit: 101 })).toThrow());
});
