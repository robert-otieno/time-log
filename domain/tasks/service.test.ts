import type { Firestore, Transaction } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { AuditWriter } from "@/domain/audit/command";
import type { AuditEventDraft } from "@/domain/audit/schemas";
import { createTask, restoreTask, updateTask } from "@/domain/tasks/service";

const actor = { type: "user" as const, uid: "u1", email: null, emailVerified: true, displayName: "Casey" };
const correlation = { requestId: "00000000-0000-4000-8000-000000000001", runId: null };
const timestamp = { seconds: 1, nanoseconds: 0 };
const project = { name: "Site", key: "SITE", description: null, clientId: null, status: "active", enabledTools: ["todos"], defaultVisibility: "internal", templateSource: null, createdBy: "u1", createdAt: timestamp, updatedBy: "u1", updatedAt: timestamp };
const organization = { kind: "personal", name: "Casey Workspace", slug: "casey-workspace", timezone: "America/Los_Angeles", ownerId: "u1", onboardingState: "complete", createdAt: timestamp, updatedAt: timestamp };
const member = (uid: string, role = "member", email?: string) => ({ userId: uid, ...(email ? { email, displayName: uid } : {}), role, status: "active", clientId: role === "client" ? "c1" : null, joinedAt: timestamp });
const assignment = (uid: string) => ({ userId: uid, status: "active", assignedBy: "admin", assignedAt: timestamp, removedAt: null });
const command = { title: "Draft", description: null, assigneeIds: ["u1"], priority: "high", dueAt: null, visibility: "internal", parentTaskId: null, boardColumnId: null, sortOrder: 0 };

function environment(extra: Record<string, Record<string, unknown>> = {}) {
  const records: Record<string, Record<string, unknown>> = { "organizations/o1": organization, "organizations/o1/members/u1": member("u1"), "organizations/o1/projects/p1/projectMembers/u1": assignment("u1"), "organizations/o1/projects/p1": project, ...extra };
  const writes: Array<{ method: string; path: string; data: unknown }> = [];
  const transaction = { get: vi.fn(async (ref: { path: string; id: string }) => ({ exists: Boolean(records[ref.path]), id: ref.id, data: () => records[ref.path] })), create: vi.fn((ref: { path: string }, data: unknown) => writes.push({ method: "create", path: ref.path, data })), update: vi.fn((ref: { path: string }, data: unknown) => writes.push({ method: "update", path: ref.path, data })) };
  const db = { doc: vi.fn((path: string) => ({ path, id: path.split("/").at(-1) })), collection: vi.fn((path: string) => ({ doc: () => ({ path: `${path}/new-task`, id: "new-task" }) })), runTransaction: vi.fn(async (callback: (transaction: Transaction) => Promise<unknown>) => callback(transaction as unknown as Transaction)) } as unknown as Firestore;
  const audits: AuditEventDraft[] = []; const auditRepository: AuditWriter = { append: vi.fn(async (draft) => { audits.push(draft); return { id: "a1" }; }), appendInTransaction: vi.fn((_transaction, draft) => { audits.push(draft); return { id: "a2" }; }) };
  return { db, auditRepository, writes, audits };
}

describe("task service", () => {
  it("creates an internal project task with an atomic audit", async () => {
    const env = environment(); await expect(createTask(actor, "o1", "p1", command, correlation, env)).resolves.toEqual({ id: "new-task" });
    expect(env.writes).toMatchObject([{ method: "create", path: "organizations/o1/projects/p1/tasks/new-task", data: { projectId: "p1", status: "todo", visibility: "internal" } }]);
    expect(env.audits).toMatchObject([{ action: "task.record.created", outcome: "succeeded" }]);
  });
  it("rejects client assignees and audits the failure", async () => {
    const env = environment({ "organizations/o1/members/client": member("client", "client"), "organizations/o1/projects/p1/projectMembers/client": assignment("client") });
    await expect(createTask(actor, "o1", "p1", { ...command, assigneeIds: ["client"] }, correlation, env)).rejects.toThrow("not eligible");
    expect(env.audits).toMatchObject([{ outcome: "failed", reasonCode: "task_assignee_ineligible" }]);
  });
  it("atomically queues and then attempts delivery for a newly assigned teammate", async () => {
    const deliver = vi.fn().mockResolvedValue({ ok: true, alreadySent: false });
    const env = environment({ "organizations/o1/members/u2": member("u2", "member", "u2@example.com"), "organizations/o1/projects/p1/projectMembers/u2": assignment("u2") });
    await createTask(actor, "o1", "p1", { ...command, assigneeIds: ["u2"] }, correlation, { ...env, deliver });
    expect(env.writes).toContainEqual(expect.objectContaining({ method: "create", path: "organizations/o1/projects/p1/tasks/new-task", data: expect.objectContaining({ assigneeIds: ["u2"] }) }));
    expect(env.writes).toContainEqual(expect.objectContaining({ method: "create", path: "organizations/o1/notifications/new-task", data: expect.objectContaining({ type: "assignment", recipientUserId: "u2", status: "queued" }) }));
    expect(env.audits.map((event) => event.action)).toContain("notification.email.queued");
    expect(deliver).toHaveBeenCalledWith("o1", "new-task", { db: env.db });
  });
  it("preserves assignment notification intent when the member has no stored email", async () => {
    const deliver = vi.fn().mockResolvedValue({ ok: false, code: "suppressed" });
    const env = environment({ "organizations/o1/members/u2": member("u2"), "organizations/o1/projects/p1/projectMembers/u2": assignment("u2") });
    await createTask(actor, "o1", "p1", { ...command, assigneeIds: ["u2"] }, correlation, { ...env, deliver });
    expect(env.writes).toContainEqual(expect.objectContaining({ path: "organizations/o1/notifications/new-task", data: expect.objectContaining({ recipientEmail: null, recipientUserId: "u2" }) }));
    expect(deliver).toHaveBeenCalledOnce();
  });
  it("rejects ancestry cycles", async () => {
    const base = { projectId: "p1", title: "Parent", description: null, assigneeIds: [], status: "todo", priority: "medium", dueAt: null, visibility: "internal", boardColumnId: null, sortOrder: 0, completedAt: null, archivedAt: null, createdBy: "u1", createdAt: timestamp, updatedBy: "u1", updatedAt: timestamp };
    const env = environment({ "organizations/o1/projects/p1/tasks/t1": { ...base, parentTaskId: "t2" }, "organizations/o1/projects/p1/tasks/t2": { ...base, parentTaskId: "t1" } });
    await expect(updateTask(actor, "o1", "p1", { ...command, taskId: "t1", parentTaskId: "t2" }, correlation, env)).rejects.toThrow("cycle");
    expect(env.writes).toHaveLength(0);
  });
  it("restores an archived task with an atomic audit", async () => {
    const existing = { projectId: "p1", title: "Archived", description: null, assigneeIds: [], status: "todo", priority: "medium", dueAt: null, dueTimeSet: false, visibility: "internal", parentTaskId: null, boardColumnId: null, sortOrder: 0, completedAt: null, archivedAt: timestamp, createdBy: "u1", createdAt: timestamp, updatedBy: "u1", updatedAt: timestamp };
    const env = environment({ "organizations/o1/projects/p1/tasks/t1": existing });
    await restoreTask(actor, "o1", "p1", { taskId: "t1" }, correlation, env);
    expect(env.writes).toMatchObject([{ method: "update", path: "organizations/o1/projects/p1/tasks/t1", data: { archivedAt: null } }]);
    expect(env.audits).toMatchObject([{ action: "task.record.restored", outcome: "succeeded" }]);
  });
});
