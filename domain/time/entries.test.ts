import type { Firestore, Transaction } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { AuditWriter } from "@/domain/audit/command";
import type { AuditEventDraft } from "@/domain/audit/schemas";
import { correctTimeEntry, createManualTimeEntry, stopTimer } from "@/domain/time/service";

const actor = { type: "user" as const, uid: "u1", email: null, emailVerified: true, displayName: "Casey" };
const correlation = { requestId: "00000000-0000-4000-8000-000000000001", runId: null };
const stamp = { seconds: 100, nanoseconds: 0 };
const project = { name: "Site", key: "SITE", description: null, clientId: null, status: "active", enabledTools: ["todos", "time"], defaultVisibility: "internal", templateSource: null, createdBy: "u1", createdAt: stamp, updatedBy: "u1", updatedAt: stamp };
const member = { userId: "u1", role: "member", status: "active", clientId: null, joinedAt: stamp };
const assignment = { userId: "u1", status: "active", assignedBy: "admin", assignedAt: stamp, removedAt: null };
const task = { projectId: "p1", title: "Draft", description: null, assigneeIds: ["u1"], status: "todo", priority: "medium", dueDate: null, dueAt: null, dueTimeSet: false, visibility: "internal", parentTaskId: null, boardColumnId: null, sortOrder: 0, completedAt: null, archivedAt: null, migrationSource: null, createdBy: "u1", createdAt: stamp, updatedBy: "u1", updatedAt: stamp };

function env(extra: Record<string, Record<string, unknown>> = {}) {
  const records = { "organizations/o1/members/u1": member, "organizations/o1/projects/p1/projectMembers/u1": assignment, "organizations/o1/projects/p1": project, "organizations/o1/projects/p1/tasks/t1": task, ...extra } as Record<string, Record<string, unknown>>;
  const writes: Array<{ method: string; path: string; data?: unknown }> = [];
  const ref = (path: string) => ({ path, id: path.split("/").at(-1), get: vi.fn(async () => ({ exists: Boolean(records[path]), id: path.split("/").at(-1), data: () => records[path] })) });
  const transaction = { get: vi.fn(async (reference: ReturnType<typeof ref>) => ({ exists: Boolean(records[reference.path]), id: reference.id, data: () => records[reference.path] })), create: vi.fn((reference, data) => writes.push({ method: "create", path: reference.path, data })), update: vi.fn((reference, data) => writes.push({ method: "update", path: reference.path, data })), delete: vi.fn((reference) => writes.push({ method: "delete", path: reference.path })) };
  const db = { doc: vi.fn(ref), collection: vi.fn((path: string) => ({ doc: () => ref(`${path}/entry-1`) })), runTransaction: vi.fn(async (callback: (transaction: Transaction) => Promise<unknown>) => callback(transaction as unknown as Transaction)) } as unknown as Firestore;
  const audits: AuditEventDraft[] = []; const auditRepository: AuditWriter = { append: vi.fn(async (draft) => { audits.push(draft); return { id: "a1" }; }), appendInTransaction: vi.fn((_tx, draft) => { audits.push(draft); return { id: "a2" }; }) };
  return { db, auditRepository, writes, audits };
}

describe("time entries", () => {
  it("stops a timer into an authoritative entry and clears both timer records", async () => {
    const environment = env({ "users/u1/runtime/activeTimer": { organizationId: "o1", projectId: "p1", userId: "u1", startedAt: stamp }, "organizations/o1/projects/p1/activeTimers/u1": { userId: "u1", organizationId: "o1", projectId: "p1", taskId: "t1", startedAt: stamp, note: null } });
    const result = await stopTimer(actor, { note: "Done", billable: true, clientReportingStatus: "internal" }, correlation, { ...environment, now: () => new Timestamp(160, 0) });
    expect(result.entry.durationSeconds).toBe(60);
    expect(result.taskCompleted).toBe(false);
    expect(environment.writes.map(({ method, path }) => ({ method, path }))).toEqual([{ method: "create", path: "organizations/o1/projects/p1/timeEntries/entry-1" }, { method: "delete", path: "organizations/o1/projects/p1/activeTimers/u1" }, { method: "delete", path: "users/u1/runtime/activeTimer" }]);
    expect(environment.audits.map(({ action }) => action)).toEqual(["time.timer.stopped", "time.entry.created"]);
  });

  it("atomically stops the timer and completes its task when requested", async () => {
    const environment = env({ "users/u1/runtime/activeTimer": { organizationId: "o1", projectId: "p1", userId: "u1", startedAt: stamp }, "organizations/o1/projects/p1/activeTimers/u1": { userId: "u1", organizationId: "o1", projectId: "p1", taskId: "t1", startedAt: stamp, note: null } });
    const result = await stopTimer(actor, { note: "Done", billable: false, clientReportingStatus: "internal", completeTask: true }, correlation, { ...environment, now: () => new Timestamp(160, 0) });
    expect(result.taskCompleted).toBe(true);
    expect(environment.writes.map(({ method, path }) => ({ method, path }))).toEqual([
      { method: "update", path: "organizations/o1/projects/p1/tasks/t1" },
      { method: "create", path: "organizations/o1/projects/p1/timeEntries/entry-1" },
      { method: "delete", path: "organizations/o1/projects/p1/activeTimers/u1" },
      { method: "delete", path: "users/u1/runtime/activeTimer" },
    ]);
    expect(environment.audits.map(({ action }) => action)).toEqual(["time.timer.stopped", "time.entry.created", "task.record.completed"]);
  });

  it("stops safely without duplicating completion when the task is already done", async () => {
    const environment = env({ "organizations/o1/projects/p1/tasks/t1": { ...task, status: "done", completedAt: stamp }, "users/u1/runtime/activeTimer": { organizationId: "o1", projectId: "p1", userId: "u1", startedAt: stamp }, "organizations/o1/projects/p1/activeTimers/u1": { userId: "u1", organizationId: "o1", projectId: "p1", taskId: "t1", startedAt: stamp, note: null } });
    const result = await stopTimer(actor, { note: null, billable: false, clientReportingStatus: "internal", completeTask: true }, correlation, { ...environment, now: () => new Timestamp(160, 0) });
    expect(result.taskCompleted).toBe(false);
    expect(environment.writes.some(({ method, path }) => method === "update" && path.endsWith("/tasks/t1"))).toBe(false);
    expect(environment.audits.map(({ action }) => action)).toEqual(["time.timer.stopped", "time.entry.created"]);
  });

  it("leaves the timer intact when completion targets an archived task", async () => {
    const environment = env({ "organizations/o1/projects/p1/tasks/t1": { ...task, archivedAt: stamp }, "users/u1/runtime/activeTimer": { organizationId: "o1", projectId: "p1", userId: "u1", startedAt: stamp }, "organizations/o1/projects/p1/activeTimers/u1": { userId: "u1", organizationId: "o1", projectId: "p1", taskId: "t1", startedAt: stamp, note: null } });
    await expect(stopTimer(actor, { note: null, billable: false, clientReportingStatus: "internal", completeTask: true }, correlation, { ...environment, now: () => new Timestamp(160, 0) })).rejects.toThrow("read-only");
    expect(environment.writes).toHaveLength(0);
    expect(environment.audits).toMatchObject([{ action: "time.timer.stopped", outcome: "denied", reasonCode: "task_archived" }]);
  });

  it("calculates manual duration on the server and requires member tasks", async () => {
    const environment = env();
    const result = await createManualTimeEntry(actor, "o1", "p1", { taskId: "t1", startedAt: "2026-09-20T08:00:00.000Z", endedAt: "2026-09-20T09:15:00.000Z", note: null, billable: false, clientReportingStatus: "internal" }, correlation, { ...environment, now: () => Timestamp.fromDate(new Date("2026-09-20T10:00:00.000Z")) });
    expect(result.durationSeconds).toBe(4500);
    await expect(createManualTimeEntry(actor, "o1", "p1", { taskId: null, startedAt: "2026-09-20T08:00:00.000Z", endedAt: "2026-09-20T09:00:00.000Z", note: null, billable: false, clientReportingStatus: "internal" }, correlation, { ...env(), now: () => Timestamp.fromDate(new Date("2026-09-20T10:00:00.000Z")) })).rejects.toThrow("saved task");
  });

  it("audits invalid manual time ranges", async () => {
    const environment = env();
    await expect(createManualTimeEntry(actor, "o1", "p1", { taskId: "t1", startedAt: "2026-09-20T09:00:00.000Z", endedAt: "2026-09-20T08:00:00.000Z", note: null, billable: false, clientReportingStatus: "internal" }, correlation, { ...environment, now: () => Timestamp.fromDate(new Date("2026-09-20T10:00:00.000Z")) })).rejects.toThrow("after start");
    expect(environment.audits).toMatchObject([{ action: "time.entry.created", outcome: "failed", reasonCode: "time_range_invalid" }]);
    expect(environment.writes).toHaveLength(0);
  });

  it("rejects member corrections to another user's entry", async () => {
    const existing = { id: "entry-1", organizationId: "o1", projectId: "p1", taskId: "t1", userId: "u2", source: "manual", startedAt: stamp, endedAt: { seconds: 160, nanoseconds: 0 }, durationSeconds: 60, note: null, billable: false, clientReportingStatus: "internal", correctionCount: 0, createdBy: "u2", createdAt: stamp, updatedBy: "u2", updatedAt: stamp };
    const environment = env({ "organizations/o1/projects/p1/timeEntries/entry-1": existing });
    await expect(correctTimeEntry(actor, "o1", "p1", { entryId: "entry-1", taskId: "t1", startedAt: "2026-09-20T08:00:00.000Z", endedAt: "2026-09-20T09:00:00.000Z", note: null, billable: false, clientReportingStatus: "internal" }, correlation, { ...environment, now: () => Timestamp.fromDate(new Date("2026-09-20T10:00:00.000Z")) })).rejects.toThrow("denied");
    expect(environment.writes).toHaveLength(0);
  });

  it("audits invalid correction ranges", async () => {
    const existing = { id: "entry-1", organizationId: "o1", projectId: "p1", taskId: "t1", userId: "u1", source: "manual", startedAt: stamp, endedAt: { seconds: 160, nanoseconds: 0 }, durationSeconds: 60, note: null, billable: false, clientReportingStatus: "internal", correctionCount: 0, createdBy: "u1", createdAt: stamp, updatedBy: "u1", updatedAt: stamp };
    const environment = env({ "organizations/o1/projects/p1/timeEntries/entry-1": existing });
    await expect(correctTimeEntry(actor, "o1", "p1", { entryId: "entry-1", taskId: "t1", startedAt: "2026-09-20T09:00:00.000Z", endedAt: "2026-09-20T08:00:00.000Z", note: null, billable: false, clientReportingStatus: "internal" }, correlation, { ...environment, now: () => Timestamp.fromDate(new Date("2026-09-20T10:00:00.000Z")) })).rejects.toThrow("after start");
    expect(environment.audits).toMatchObject([{ action: "time.entry.corrected", outcome: "failed", reasonCode: "time_range_invalid" }]);
  });
});
