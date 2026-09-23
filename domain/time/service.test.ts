import type { Firestore, Transaction } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { AuditWriter } from "@/domain/audit/command";
import type { AuditEventDraft } from "@/domain/audit/schemas";
import { elapsedTimerSeconds, getActiveTimer, pauseTimer, resumeTimer, startTimer, trackedTimerSeconds } from "@/domain/time/service";

const actor = { type: "user" as const, uid: "u1", email: null, emailVerified: true, displayName: "Casey" };
const correlation = { requestId: "00000000-0000-4000-8000-000000000001", runId: null };
const timestamp = { seconds: 1, nanoseconds: 0 };
const startedAt = new Timestamp(100, 0);
const project = { name: "Site", key: "SITE", description: null, clientId: null, status: "active", enabledTools: ["todos", "time"], defaultVisibility: "internal", templateSource: null, createdBy: "u1", createdAt: timestamp, updatedBy: "u1", updatedAt: timestamp };
const membership = (role: "admin" | "member" | "client" = "member") => ({ userId: "u1", role, status: "active", clientId: role === "client" ? "c1" : null, joinedAt: timestamp });
const assignment = { userId: "u1", status: "active", assignedBy: "admin", assignedAt: timestamp, removedAt: null };
const task = { projectId: "p1", title: "Draft", description: null, assigneeIds: ["u1"], status: "todo", priority: "medium", dueDate: null, dueAt: null, dueTimeSet: false, visibility: "internal", parentTaskId: null, boardColumnId: null, sortOrder: 0, completedAt: null, archivedAt: null, migrationSource: null, createdBy: "u1", createdAt: timestamp, updatedBy: "u1", updatedAt: timestamp };

function environment(overrides: Record<string, Record<string, unknown>> = {}, role: "admin" | "member" | "client" = "member") {
  const records: Record<string, Record<string, unknown>> = {
    "organizations/o1/members/u1": membership(role),
    "organizations/o1/projects/p1/projectMembers/u1": assignment,
    "organizations/o1/projects/p1": project,
    "organizations/o1/projects/p1/tasks/t1": task,
    ...overrides,
  };
  const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
  const reference = (path: string) => ({ path, id: path.split("/").at(-1), get: vi.fn(async () => ({ exists: Boolean(records[path]), id: path.split("/").at(-1), data: () => records[path] })) });
  const transaction = {
    get: vi.fn(async (ref: ReturnType<typeof reference>) => ({ exists: Boolean(records[ref.path]), id: ref.id, data: () => records[ref.path] })),
    create: vi.fn((ref: ReturnType<typeof reference>, data: Record<string, unknown>) => writes.push({ path: ref.path, data })),
    update: vi.fn((ref: ReturnType<typeof reference>, data: Record<string, unknown>) => writes.push({ path: ref.path, data })),
  };
  const db = { doc: vi.fn(reference), runTransaction: vi.fn(async (callback: (value: Transaction) => Promise<unknown>) => callback(transaction as unknown as Transaction)) } as unknown as Firestore;
  const audits: AuditEventDraft[] = [];
  const auditRepository: AuditWriter = {
    append: vi.fn(async (draft) => { audits.push(draft); return { id: "audit-failure" }; }),
    appendInTransaction: vi.fn((_transaction, draft) => { audits.push(draft); return { id: "audit-success" }; }),
  };
  return { db, auditRepository, writes, audits };
}

describe("active timer service", () => {
  it("atomically creates the project timer, global pointer, and audit for a member task", async () => {
    const env = environment();
    const timer = await startTimer(actor, "o1", "p1", { taskId: "t1", note: "Draft the brief" }, correlation, { ...env, now: () => startedAt });
    expect(timer).toMatchObject({ userId: "u1", projectId: "p1", taskId: "t1", note: "Draft the brief" });
    expect(env.writes.map(({ path }) => path)).toEqual([
      "organizations/o1/projects/p1/activeTimers/u1",
      "users/u1/runtime/activeTimer",
    ]);
    expect(env.audits).toMatchObject([{ action: "time.timer.started", outcome: "succeeded", target: { type: "timer", id: "u1" } }]);
  });

  it("requires a saved task for members but permits admin project-level timers", async () => {
    const memberEnv = environment();
    await expect(startTimer(actor, "o1", "p1", {}, correlation, { ...memberEnv, now: () => startedAt })).rejects.toThrow("saved task");
    expect(memberEnv.audits).toMatchObject([{ outcome: "denied", reasonCode: "timer_task_required" }]);

    const adminEnv = environment({}, "admin");
    await expect(startTimer(actor, "o1", "p1", {}, correlation, { ...adminEnv, now: () => startedAt })).resolves.toMatchObject({ taskId: null });
  });

  it("denies clients and a second active timer", async () => {
    const clientEnv = environment({}, "client");
    await expect(startTimer(actor, "o1", "p1", { taskId: "t1" }, correlation, { ...clientEnv, now: () => startedAt })).rejects.toThrow("denied");
    expect(clientEnv.audits).toMatchObject([{ outcome: "denied", reasonCode: "timer_start_denied" }]);

    const conflictEnv = environment({ "users/u1/runtime/activeTimer": { organizationId: "other", projectId: "other", userId: "u1", startedAt: timestamp } });
    await expect(startTimer(actor, "o1", "p1", { taskId: "t1" }, correlation, { ...conflictEnv, now: () => startedAt })).rejects.toThrow("already active");
    expect(conflictEnv.writes).toHaveLength(0);
    expect(conflictEnv.audits).toMatchObject([{ outcome: "denied", reasonCode: "timer_already_active" }]);
  });

  it("rejects archived or completed tasks and projects without available time tracking", async () => {
    const taskEnv = environment({ "organizations/o1/projects/p1/tasks/t1": { ...task, archivedAt: timestamp } });
    await expect(startTimer(actor, "o1", "p1", { taskId: "t1" }, correlation, { ...taskEnv, now: () => startedAt })).rejects.toThrow("unavailable");
    expect(taskEnv.audits).toMatchObject([{ outcome: "denied", reasonCode: "timer_task_unavailable" }]);

    const completedTaskEnv = environment({ "organizations/o1/projects/p1/tasks/t1": { ...task, status: "done", completedAt: timestamp } });
    await expect(startTimer(actor, "o1", "p1", { taskId: "t1" }, correlation, { ...completedTaskEnv, now: () => startedAt })).rejects.toThrow("unavailable");
    expect(completedTaskEnv.audits).toMatchObject([{ outcome: "denied", reasonCode: "timer_task_unavailable" }]);

    const projectEnv = environment({ "organizations/o1/projects/p1": { ...project, enabledTools: ["todos"] } });
    await expect(startTimer(actor, "o1", "p1", { taskId: "t1" }, correlation, { ...projectEnv, now: () => startedAt })).rejects.toThrow("unavailable");
    expect(projectEnv.audits).toMatchObject([{ outcome: "denied", reasonCode: "project_time_unavailable" }]);
  });

  it("resolves the active timer through the owner pointer and calculates elapsed seconds", async () => {
    const pointer = { organizationId: "o1", projectId: "p1", userId: "u1", startedAt: timestamp };
    const timer = { userId: "u1", organizationId: "o1", projectId: "p1", taskId: "t1", startedAt: timestamp, note: null };
    const env = environment({ "users/u1/runtime/activeTimer": pointer, "organizations/o1/projects/p1/activeTimers/u1": timer });
    await expect(getActiveTimer(actor, env.db)).resolves.toMatchObject(timer);
    expect(elapsedTimerSeconds(timestamp, new Date(4_900))).toBe(3);
    expect(elapsedTimerSeconds(timestamp, new Date(500))).toBe(0);
  });

  it("pauses and resumes the same timer without counting paused time", async () => {
    const pointer = { organizationId: "o1", projectId: "p1", userId: "u1", startedAt: timestamp };
    const timer = { userId: "u1", organizationId: "o1", projectId: "p1", taskId: "t1", startedAt: timestamp, note: null };
    const pausedEnv = environment({ "users/u1/runtime/activeTimer": pointer, "organizations/o1/projects/p1/activeTimers/u1": timer });
    const paused = await pauseTimer(actor, correlation, { ...pausedEnv, now: () => new Timestamp(10, 0) });
    expect(paused).toMatchObject({ state: "paused", accumulatedSeconds: 9, currentSegmentStartedAt: null, pauseReason: "manual" });
    expect(trackedTimerSeconds(paused, new Date(60_000))).toBe(9);
    expect(pausedEnv.audits).toMatchObject([{ action: "time.timer.paused", outcome: "succeeded" }]);

    const resumedEnv = environment({ "users/u1/runtime/activeTimer": pointer, "organizations/o1/projects/p1/activeTimers/u1": paused });
    const resumed = await resumeTimer(actor, correlation, { ...resumedEnv, now: () => new Timestamp(20, 0) });
    expect(resumed).toMatchObject({ state: "running", accumulatedSeconds: 9, pauseReason: null });
    expect(trackedTimerSeconds(resumed, new Date(25_000))).toBe(14);
    expect(resumedEnv.audits).toMatchObject([{ action: "time.timer.resumed", outcome: "succeeded" }]);
  });
});
