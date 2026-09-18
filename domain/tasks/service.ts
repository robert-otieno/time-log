import "server-only";
import { FieldValue, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { canAccessProject, hasCapability } from "@/domain/organizations/policy";
import { organizationMemberSchema, projectAssignmentSchema, projectSchema } from "@/domain/organizations/schemas";
import { archiveTaskCommandSchema, changeTaskStatusCommandSchema, createTaskCommandSchema, projectTaskSchema, restoreTaskCommandSchema, updateTaskCommandSchema } from "@/domain/tasks/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

type Dependencies = { db?: Firestore; auditRepository?: AuditWriter };
const taskPath = (organizationId: string, projectId: string, taskId: string) => `organizations/${organizationId}/projects/${projectId}/tasks/${taskId}`;

async function requireTaskWriter(transaction: Transaction, db: Firestore, organizationId: string, projectId: string, uid: string) {
  const [memberDoc, assignmentDoc, projectDoc] = await Promise.all([
    transaction.get(db.doc(`organizations/${organizationId}/members/${uid}`)),
    transaction.get(db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${uid}`)),
    transaction.get(db.doc(`organizations/${organizationId}/projects/${projectId}`)),
  ]);
  const member = memberDoc.exists ? organizationMemberSchema.parse(memberDoc.data()) : null;
  const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
  if (!hasCapability(member, "tasks.manage") || !canAccessProject(member, assignment)) throw new AuditedCommandError("denied", "task_manage_denied", "Task management denied");
  if (!projectDoc.exists) throw new AuditedCommandError("failed", "project_not_found", "Project not found");
  const project = projectSchema.parse({ id: projectDoc.id, ...projectDoc.data() });
  if (project.status !== "active" || !project.enabledTools.includes("todos")) throw new AuditedCommandError("denied", "project_tasks_read_only", "Project tasks are unavailable");
  return member!;
}

async function validateAssignees(transaction: Transaction, db: Firestore, organizationId: string, projectId: string, ids: readonly string[]) {
  for (const uid of ids) {
    const [memberDoc, assignmentDoc] = await Promise.all([
      transaction.get(db.doc(`organizations/${organizationId}/members/${uid}`)),
      transaction.get(db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${uid}`)),
    ]);
    const member = memberDoc.exists ? organizationMemberSchema.parse(memberDoc.data()) : null;
    const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
    if (!member || member.status !== "active" || member.role === "client" || !canAccessProject(member, assignment)) throw new AuditedCommandError("failed", "task_assignee_ineligible", "An assignee is not eligible for this project");
  }
}

async function validateParent(transaction: Transaction, db: Firestore, organizationId: string, projectId: string, taskId: string, parentTaskId: string | null) {
  let current = parentTaskId; const visited = new Set([taskId]);
  for (let depth = 0; current; depth++) {
    if (visited.has(current)) throw new AuditedCommandError("failed", "task_parent_cycle", "Task hierarchy cannot contain a cycle");
    if (depth >= 100) throw new AuditedCommandError("failed", "task_parent_depth", "Task hierarchy is too deep");
    visited.add(current); const snapshot = await transaction.get(db.doc(taskPath(organizationId, projectId, current)));
    if (!snapshot.exists) throw new AuditedCommandError("failed", "task_parent_not_found", "Parent task not found");
    current = projectTaskSchema.parse({ id: snapshot.id, ...snapshot.data() }).parentTaskId;
  }
}

const dueAt = (value: string | null) => value ? Timestamp.fromDate(new Date(value)) : null;

export async function createTask(actor: AuthActor, organizationId: string, projectId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = createTaskCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const reference = db.collection(`organizations/${organizationId}/projects/${projectId}/tasks`).doc();
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "task.record.created", target: { type: "task", id: reference.id }, correlation, changes: [{ field: "status", to: "todo" }, { field: "visibility", to: command.visibility }], execute: async (transaction) => {
    await requireTaskWriter(transaction, db, organizationId, projectId, actor.uid); await validateAssignees(transaction, db, organizationId, projectId, command.assigneeIds); await validateParent(transaction, db, organizationId, projectId, reference.id, command.parentTaskId);
    const now = FieldValue.serverTimestamp(); transaction.create(reference, { ...command, projectId, dueAt: dueAt(command.dueAt), status: "todo", completedAt: null, archivedAt: null, createdBy: actor.uid, createdAt: now, updatedBy: actor.uid, updatedAt: now }); return { id: reference.id };
  }});
}

export async function updateTask(actor: AuthActor, organizationId: string, projectId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = updateTaskCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const reference = db.doc(taskPath(organizationId, projectId, command.taskId));
  return executeAuditedCommand<{ status: "backlog" | "todo" | "in_progress" | "blocked" | "done"; previousVisibility: "internal" | "client-visible" }>({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "task.record.updated", target: { type: "task", id: command.taskId }, correlation, changes: (result) => [{ field: "status", to: result.status }, { field: "visibility", from: result.previousVisibility, to: command.visibility }], additionalSuccessAudits: (result) => result.previousVisibility === command.visibility ? [] : [{ action: "visibility.record.changed", target: { type: "task", id: command.taskId }, changes: [{ field: "visibility", from: result.previousVisibility, to: command.visibility }] }], execute: async (transaction) => {
    await requireTaskWriter(transaction, db, organizationId, projectId, actor.uid); const snapshot = await transaction.get(reference); if (!snapshot.exists) throw new AuditedCommandError("failed", "task_not_found", "Task not found"); const existing = projectTaskSchema.parse({ id: snapshot.id, ...snapshot.data() }); if (existing.archivedAt) throw new AuditedCommandError("denied", "task_archived", "Archived tasks are read-only"); await validateAssignees(transaction, db, organizationId, projectId, command.assigneeIds); await validateParent(transaction, db, organizationId, projectId, command.taskId, command.parentTaskId); const { taskId: _, ...values } = command; void _; transaction.update(reference, { ...values, dueAt: dueAt(values.dueAt), updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }); return { status: existing.status, previousVisibility: existing.visibility };
  }});
}

export async function changeTaskStatus(actor: AuthActor, organizationId: string, projectId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = changeTaskStatusCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const reference = db.doc(taskPath(organizationId, projectId, command.taskId));
  const action = command.status === "done" ? "task.record.completed" : "task.record.reopened";
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action, target: { type: "task", id: command.taskId }, correlation, changes: [{ field: "status", to: command.status }], execute: async (transaction) => { await requireTaskWriter(transaction, db, organizationId, projectId, actor.uid); const snapshot = await transaction.get(reference); if (!snapshot.exists) throw new AuditedCommandError("failed", "task_not_found", "Task not found"); const task = projectTaskSchema.parse({ id: snapshot.id, ...snapshot.data() }); if (task.archivedAt) throw new AuditedCommandError("denied", "task_archived", "Archived tasks are read-only"); transaction.update(reference, { status: command.status, completedAt: command.status === "done" ? FieldValue.serverTimestamp() : null, updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }); }});
}

export async function archiveTask(actor: AuthActor, organizationId: string, projectId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = archiveTaskCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const reference = db.doc(taskPath(organizationId, projectId, command.taskId));
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "task.record.archived", target: { type: "task", id: command.taskId }, correlation, changes: [{ field: "status", to: "archived" }], execute: async (transaction) => { await requireTaskWriter(transaction, db, organizationId, projectId, actor.uid); const snapshot = await transaction.get(reference); if (!snapshot.exists) throw new AuditedCommandError("failed", "task_not_found", "Task not found"); transaction.update(reference, { archivedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }); }});
}

export async function restoreTask(actor: AuthActor, organizationId: string, projectId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = restoreTaskCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const reference = db.doc(taskPath(organizationId, projectId, command.taskId));
  return executeAuditedCommand<{ status: "backlog" | "todo" | "in_progress" | "blocked" | "done" }>({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "task.record.restored", target: { type: "task", id: command.taskId }, correlation, changes: (result) => [{ field: "status", from: "archived", to: result.status }], execute: async (transaction) => { await requireTaskWriter(transaction, db, organizationId, projectId, actor.uid); const snapshot = await transaction.get(reference); if (!snapshot.exists) throw new AuditedCommandError("failed", "task_not_found", "Task not found"); const task = projectTaskSchema.parse({ id: snapshot.id, ...snapshot.data() }); if (!task.archivedAt) throw new AuditedCommandError("failed", "task_not_archived", "Task is not archived"); transaction.update(reference, { archivedAt: null, updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }); return { status: task.status }; }});
}
