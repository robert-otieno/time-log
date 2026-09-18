import { describe, expect, it } from "vitest";
import { toTaskListItem } from "@/domain/tasks/form-data";
import type { ProjectTask } from "@/domain/tasks/schemas";

const timestamp = { seconds: 1, nanoseconds: 500000000 };
const task = { id: "t1", projectId: "p1", title: "Draft", description: "Shared detail", assigneeIds: ["u1"], status: "todo", priority: "high", dueDate: "1970-01-01", dueAt: timestamp, dueTimeSet: true, visibility: "client-visible", parentTaskId: null, boardColumnId: null, sortOrder: 1, completedAt: null, archivedAt: null, createdBy: "u1", createdAt: timestamp, updatedBy: "u1", updatedAt: timestamp } as ProjectTask;

describe("task list DTO", () => {
  it("converts Firestore timestamps to plain ISO strings", () => {
    const result = toTaskListItem(task);
    expect(result.dueAt).toBe("1970-01-01T00:00:01.500Z");
    expect(JSON.stringify(result)).not.toContain("nanoseconds");
  });
  it("removes assignee identifiers from client output", () => expect(toTaskListItem(task, true).assigneeIds).toEqual([]));
});
