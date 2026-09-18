import type { Firestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ listAccessibleProjects: vi.fn(), listTasks: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/domain/projects/service", () => ({ listAccessibleProjects: mocks.listAccessibleProjects }));
vi.mock("@/domain/tasks/repository", () => ({ TaskRepository: class { list = mocks.listTasks; } }));
import { dateInTimeZone, groupMyWorkTasks, loadMyWork, type MyWorkTask } from "@/domain/tasks/my-work";

const project = { id: "p1", name: "Website", key: "WEB", timeEnabled: true };
const task = (id: string, dueDate: string | null, status: MyWorkTask["status"] = "todo", priority: MyWorkTask["priority"] = "medium"): MyWorkTask => ({ id, title: id, description: null, assigneeIds: ["u1"], status, priority, dueDate, dueAt: null, dueTimeSet: false, visibility: "internal", parentTaskId: null, sortOrder: 0, archivedAt: null, project });

describe("My Work grouping", () => {
  beforeEach(() => vi.clearAllMocks());
  it("derives today in the configured timezone", () => {
    const instant = new Date("2026-09-19T02:00:00.000Z");
    expect(dateInTimeZone(instant, "America/Los_Angeles")).toBe("2026-09-18");
    expect(dateInTimeZone(instant, "Asia/Tokyo")).toBe("2026-09-19");
  });

  it("groups unfinished tasks and excludes completed or archived work", () => {
    const archived = { ...task("archived", null), archivedAt: "2026-09-18T00:00:00.000Z" };
    const groups = groupMyWorkTasks([task("late", "2026-09-17"), task("today", "2026-09-18"), task("next", "2026-09-19"), task("someday", null), task("done", "2026-09-18", "done"), archived], "America/Los_Angeles", new Date("2026-09-18T19:00:00.000Z"));
    expect(groups.overdue.map(({ id }) => id)).toEqual(["late"]);
    expect(groups.today.map(({ id }) => id)).toEqual(["today"]);
    expect(groups.upcoming.map(({ id }) => id)).toEqual(["next"]);
    expect(groups.noDueDate.map(({ id }) => id)).toEqual(["someday"]);
  });

  it("uses priority as the tie-breaker within a due date", () => {
    const groups = groupMyWorkTasks([task("low", "2026-09-18", "todo", "low"), task("urgent", "2026-09-18", "blocked", "urgent")], "UTC", new Date("2026-09-18T12:00:00.000Z"));
    expect(groups.today.map(({ id }) => id)).toEqual(["urgent", "low"]);
  });

  it("queries only accessible active to-do projects for the current assignee", async () => {
    const timestamp = { seconds: 1, nanoseconds: 0 };
    const projectRecord = (id: string, status: "active" | "on_hold", enabledTools: Array<"todos" | "time">) => ({ id, name: id, key: id === "p1" ? "P1" : "P2", description: null, clientId: null, status, enabledTools, defaultVisibility: "internal", templateSource: null, createdBy: "u1", createdAt: timestamp, updatedBy: "u1", updatedAt: timestamp });
    mocks.listAccessibleProjects.mockResolvedValue([projectRecord("p1", "active", ["todos", "time"]), projectRecord("p2", "on_hold", ["todos"]), projectRecord("p3", "active", ["time"])]);
    mocks.listTasks.mockResolvedValue([]);
    const documents: Record<string, { id: string; data: Record<string, unknown> }> = {
      "organizations/o1": { id: "o1", data: { kind: "personal", name: "Workspace", slug: "workspace", timezone: "UTC", ownerId: "u1", onboardingState: "complete", createdAt: timestamp, updatedAt: timestamp } },
      "organizations/o1/members/u1": { id: "u1", data: { userId: "u1", role: "member", status: "active", clientId: null, joinedAt: timestamp } },
    };
    const db = { doc: (path: string) => ({ get: async () => ({ exists: Boolean(documents[path]), id: documents[path]?.id, data: () => documents[path]?.data }) }) } as unknown as Firestore;
    await loadMyWork({ type: "user", uid: "u1", email: null, emailVerified: true, displayName: null }, "o1", db);
    expect(mocks.listTasks).toHaveBeenCalledTimes(1);
    expect(mocks.listTasks).toHaveBeenCalledWith("o1", "p1", { assigneeId: "u1", limit: 100 }, { kind: "all" });
  });
});
