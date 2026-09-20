import "server-only";
import { FieldValue, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { canAccessProject, hasCapability } from "@/domain/organizations/policy";
import { organizationMemberSchema, organizationSchema, projectAssignmentSchema, projectSchema, type OrganizationMember } from "@/domain/organizations/schemas";
import { deliverNotification } from "@/domain/notifications/outbox";
import { archiveTaskCommandSchema, changeTaskStatusCommandSchema, createTaskCommandSchema, projectTaskSchema, restoreTaskCommandSchema, updateTaskCommandSchema } from "@/domain/tasks/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseApplicationUrl } from "@/lib/resend-config";

type Dependencies = { db?: Firestore; auditRepository?: AuditWriter; deliver?: typeof deliverNotification };
const taskPath = (organizationId: string, projectId: string, taskId: string) => `organizations/${organizationId}/projects/${projectId}/tasks/${taskId}`;

async function requireTaskWriter(transaction: Transaction, db: Firestore, organizationId: string, projectId: string, uid: string) {
  const [memberDoc, assignmentDoc, projectDoc, organizationDoc] = await Promise.all([
    transaction.get(db.doc(`organizations/${organizationId}/members/${uid}`)),
    transaction.get(db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${uid}`)),
    transaction.get(db.doc(`organizations/${organizationId}/projects/${projectId}`)),
    transaction.get(db.doc(`organizations/${organizationId}`)),
  ]);
  const member = memberDoc.exists ? organizationMemberSchema.parse(memberDoc.data()) : null;
  const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
  if (!hasCapability(member, "tasks.manage") || !canAccessProject(member, assignment)) throw new AuditedCommandError("denied", "task_manage_denied", "Task management denied");
  if (!projectDoc.exists) throw new AuditedCommandError("failed", "project_not_found", "Project not found");
  if (!organizationDoc.exists) throw new AuditedCommandError("failed", "organization_not_found", "Organization not found");
  const project = projectSchema.parse({ id: projectDoc.id, ...projectDoc.data() });
  if (project.status !== "active" || !project.enabledTools.includes("todos")) throw new AuditedCommandError("denied", "project_tasks_read_only", "Project tasks are unavailable");
  return { member: member!, project, organization: organizationSchema.parse({ id: organizationDoc.id, ...organizationDoc.data() }) };
}

async function validateAssignees(transaction: Transaction, db: Firestore, organizationId: string, projectId: string, ids: readonly string[]) {
  const members = new Map<string, OrganizationMember>();
  for (const uid of ids) {
    const [memberDoc, assignmentDoc] = await Promise.all([
      transaction.get(db.doc(`organizations/${organizationId}/members/${uid}`)),
      transaction.get(db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${uid}`)),
    ]);
    const member = memberDoc.exists ? organizationMemberSchema.parse(memberDoc.data()) : null;
    const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
    if (!member || member.status !== "active" || member.role === "client" || !canAccessProject(member, assignment)) throw new AuditedCommandError("failed", "task_assignee_ineligible", "An assignee is not eligible for this project");
    members.set(uid, member);
  }
  return members;
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
  const notificationRefs = new Map(command.assigneeIds.filter((uid) => uid !== actor.uid).map((uid) => [uid, db.collection(`organizations/${organizationId}/notifications`).doc()]));
  const result = await executeAuditedCommand<{ id: string; notificationIds: string[] }>({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "task.record.created", target: { type: "task", id: reference.id }, correlation, changes: [{ field: "status", to: "todo" }, { field: "visibility", to: command.visibility }], additionalSuccessAudits: (value) => value.notificationIds.map((id) => ({ action: "notification.email.queued", target: { type: "notification", id }, changes: [{ field: "deliveryStatus", to: "queued" }] })), execute: async (transaction) => {
    const access = await requireTaskWriter(transaction, db, organizationId, projectId, actor.uid); const assignees = await validateAssignees(transaction, db, organizationId, projectId, command.assigneeIds); await validateParent(transaction, db, organizationId, projectId, reference.id, command.parentTaskId);
    const now = FieldValue.serverTimestamp(); transaction.create(reference, { ...command, projectId, dueAt: dueAt(command.dueAt), status: "todo", completedAt: null, archivedAt: null, createdBy: actor.uid, createdAt: now, updatedBy: actor.uid, updatedAt: now });
    const notificationIds: string[] = [];
    for (const [uid, notificationRef] of notificationRefs) { const member = assignees.get(uid); if (!member) continue; notificationIds.push(notificationRef.id); transaction.create(notificationRef, { type: "assignment", recipientEmail: member.email ?? null, recipientUserId: uid, projectId, taskId: reference.id, templateData: { organizationName: access.organization.name, projectName: access.project.name, taskTitle: command.title, assignedByName: actor.displayName?.trim() || "A teammate", taskUrl: `${parseApplicationUrl(process.env)}/projects/${projectId}/todos?task=${reference.id}` }, status: "queued", idempotencyKey: `assignment/${notificationRef.id}`, providerMessageId: null, attemptCount: 0, lastErrorCode: null, claimId: null, claimExpiresAt: null, nextAttemptAt: null, createdAt: now, updatedAt: now }); }
    return { id: reference.id, notificationIds };
  }});
  await Promise.allSettled(result.notificationIds.map((id) => (dependencies.deliver ?? deliverNotification)(organizationId, id, { db })));
  return { id: result.id };
}

export async function updateTask(actor: AuthActor, organizationId: string, projectId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = updateTaskCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const reference = db.doc(taskPath(organizationId, projectId, command.taskId));
  const notificationRefs = new Map(command.assigneeIds.filter((uid) => uid !== actor.uid).map((uid) => [uid, db.collection(`organizations/${organizationId}/notifications`).doc()]));
  const result = await executeAuditedCommand<{ status: "backlog" | "todo" | "in_progress" | "blocked" | "done"; previousVisibility: "internal" | "client-visible"; notificationIds: string[] }>({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "task.record.updated", target: { type: "task", id: command.taskId }, correlation, changes: (result) => [{ field: "status", to: result.status }, { field: "visibility", from: result.previousVisibility, to: command.visibility }], additionalSuccessAudits: (result) => [...(result.previousVisibility === command.visibility ? [] : [{ action: "visibility.record.changed" as const, target: { type: "task" as const, id: command.taskId }, changes: [{ field: "visibility" as const, from: result.previousVisibility, to: command.visibility }] }]), ...result.notificationIds.map((id) => ({ action: "notification.email.queued" as const, target: { type: "notification" as const, id }, changes: [{ field: "deliveryStatus" as const, to: "queued" }] }))], execute: async (transaction) => {
    const access = await requireTaskWriter(transaction, db, organizationId, projectId, actor.uid); const snapshot = await transaction.get(reference); if (!snapshot.exists) throw new AuditedCommandError("failed", "task_not_found", "Task not found"); const existing = projectTaskSchema.parse({ id: snapshot.id, ...snapshot.data() }); if (existing.archivedAt) throw new AuditedCommandError("denied", "task_archived", "Archived tasks are read-only"); const assignees = await validateAssignees(transaction, db, organizationId, projectId, command.assigneeIds); await validateParent(transaction, db, organizationId, projectId, command.taskId, command.parentTaskId); const { taskId: _, ...values } = command; void _; transaction.update(reference, { ...values, dueAt: dueAt(values.dueAt), updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() });
    const notificationIds: string[] = []; const added = command.assigneeIds.filter((uid) => uid !== actor.uid && !existing.assigneeIds.includes(uid)); const now = FieldValue.serverTimestamp();
    for (const uid of added) { const member = assignees.get(uid); const notificationRef = notificationRefs.get(uid); if (!member || !notificationRef) continue; notificationIds.push(notificationRef.id); transaction.create(notificationRef, { type: "assignment", recipientEmail: member.email ?? null, recipientUserId: uid, projectId, taskId: command.taskId, templateData: { organizationName: access.organization.name, projectName: access.project.name, taskTitle: command.title, assignedByName: actor.displayName?.trim() || "A teammate", taskUrl: `${parseApplicationUrl(process.env)}/projects/${projectId}/todos?task=${command.taskId}` }, status: "queued", idempotencyKey: `assignment/${notificationRef.id}`, providerMessageId: null, attemptCount: 0, lastErrorCode: null, claimId: null, claimExpiresAt: null, nextAttemptAt: null, createdAt: now, updatedAt: now }); }
    return { status: existing.status, previousVisibility: existing.visibility, notificationIds };
  }});
  await Promise.allSettled(result.notificationIds.map((id) => (dependencies.deliver ?? deliverNotification)(organizationId, id, { db })));
  return { status: result.status, previousVisibility: result.previousVisibility };
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
