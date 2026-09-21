import { describe, expect, it } from "vitest";
import { projectIdFromProjectPath, rankTimerTasks } from "@/domain/time/launcher";

const task = (
  id: string,
  overrides: Partial<Parameters<typeof rankTimerTasks>[0][number]> = {},
) => ({
  id,
  title: id,
  assigneeIds: [] as string[],
  status: "todo" as const,
  priority: "medium" as const,
  dueDate: null,
  sortOrder: 0,
  ...overrides,
});

describe("rankTimerTasks", () => {
  it("prefers assignment, active work, deadline, priority, and stable task order", () => {
    const tasks = [
      task("unassigned", { status: "in_progress", priority: "urgent" }),
      task("later", { assigneeIds: ["u1"], dueDate: "2026-10-02", priority: "urgent" }),
      task("priority", { assigneeIds: ["u1"], dueDate: "2026-10-01", priority: "high" }),
      task("active", { assigneeIds: ["u1"], status: "in_progress", dueDate: "2026-12-01" }),
      task("due", { assigneeIds: ["u1"], dueDate: "2026-10-01", priority: "urgent", sortOrder: 2 }),
      task("ordered", { assigneeIds: ["u1"], dueDate: "2026-10-01", priority: "urgent", sortOrder: 1 }),
    ];

    expect(rankTimerTasks(tasks, "u1").map(({ id }) => id)).toEqual([
      "active",
      "ordered",
      "due",
      "priority",
      "later",
      "unassigned",
    ]);
  });

  it("does not mutate the repository result", () => {
    const tasks = [task("second", { sortOrder: 2 }), task("first", { sortOrder: 1 })];
    rankTimerTasks(tasks, "u1");
    expect(tasks.map(({ id }) => id)).toEqual(["second", "first"]);
  });
});

describe("projectIdFromProjectPath", () => {
  it.each([
    ["/projects/project-1", "project-1"],
    ["/projects/project-1/todos", "project-1"],
    ["/projects/project-1/settings", "project-1"],
    ["/projects", null],
    ["/settings", null],
  ])("reads project context from %s", (pathname, expected) => {
    expect(projectIdFromProjectPath(pathname)).toBe(expected);
  });
});
