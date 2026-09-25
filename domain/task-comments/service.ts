import "server-only";
import { createHash } from "node:crypto";
import { FieldValue, type DocumentReference, type Firestore, type Transaction } from "firebase-admin/firestore";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { canAccessProject } from "@/domain/organizations/policy";
import { organizationMemberSchema, projectAssignmentSchema, projectSchema, type OrganizationMember, type ProjectAssignment } from "@/domain/organizations/schemas";
import { deliverNotification } from "@/domain/notifications/outbox";
import { projectTaskSchema, type ProjectTask } from "@/domain/tasks/schemas";
import { canModerateTaskComments, canReadTaskComment } from "@/domain/task-comments/policy";
import { createTaskCommentCommandSchema, deleteTaskCommentCommandSchema, taskCommentSchema, updateTaskCommentCommandSchema, type TaskComment, type TaskCommentAudience } from "@/domain/task-comments/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseApplicationUrl } from "@/lib/resend-config";

type Dependencies = { db?: Firestore; auditRepository?: AuditWriter; deliver?: typeof deliverNotification };
const taskPath = (org: string, project: string, task: string) => `organizations/${org}/projects/${project}/tasks/${task}`;
const commentPath = (org: string, project: string, task: string, comment: string) => `${taskPath(org, project, task)}/comments/${comment}`;
const actorName = (actor: AuthActor) => actor.displayName?.trim() || actor.email || "A teammate";

async function access(transaction: Transaction, db: Firestore, org: string, projectId: string, taskId: string, uid: string) {
  const [memberDoc, assignmentDoc, projectDoc, taskDoc] = await Promise.all([
    transaction.get(db.doc(`organizations/${org}/members/${uid}`)), transaction.get(db.doc(`organizations/${org}/projects/${projectId}/projectMembers/${uid}`)), transaction.get(db.doc(`organizations/${org}/projects/${projectId}`)), transaction.get(db.doc(taskPath(org, projectId, taskId))),
  ]);
  const member = memberDoc.exists ? organizationMemberSchema.parse(memberDoc.data()) : null; const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
  if (!member || !canAccessProject(member, assignment)) throw new AuditedCommandError("denied", "task_comment_access_denied", "Task discussion access denied");
  if (!projectDoc.exists || !taskDoc.exists) throw new AuditedCommandError("failed", "task_comment_context_missing", "Task discussion unavailable");
  const project = projectSchema.parse({ id: projectDoc.id, ...projectDoc.data() }); const task = projectTaskSchema.parse({ id: taskDoc.id, ...taskDoc.data() });
  if (!project.enabledTools.includes("todos") || project.status !== "active" || task.archivedAt || (member.role === "client" && task.visibility !== "client-visible")) throw new AuditedCommandError("denied", "task_comment_unavailable", "Task discussion unavailable");
  return { member, assignment, project, task, moderator: canModerateTaskComments(member, assignment) };
}

async function participant(transaction: Transaction, db: Firestore, org: string, projectId: string, userId: string) {
  const [memberDoc, assignmentDoc] = await Promise.all([transaction.get(db.doc(`organizations/${org}/members/${userId}`)), transaction.get(db.doc(`organizations/${org}/projects/${projectId}/projectMembers/${userId}`))]);
  if (!memberDoc.exists) return null;
  const member = organizationMemberSchema.parse(memberDoc.data()); const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
  return canAccessProject(member, assignment) ? { member, assignment } : null;
}

function validateAudience(member: OrganizationMember, task: ProjectTask, audience: TaskCommentAudience, audienceUserIds: string[]) {
  if (member.role === "client" && audience !== "client_visible") throw new AuditedCommandError("denied", "task_comment_audience_denied", "Clients can only post client-visible comments");
  if (audience === "client_visible" && task.visibility !== "client-visible") throw new AuditedCommandError("denied", "task_comment_parent_internal", "Internal tasks cannot contain client-visible comments");
  if (audience === "selected" && audienceUserIds.length === 0) throw new AuditedCommandError("failed", "task_comment_recipients_required", "Choose at least one person");
}

function notificationValue(input: { ref: DocumentReference; recipient: OrganizationMember; projectId: string; projectName: string; taskId: string; taskTitle: string; commentId: string; authorName: string; now: FirebaseFirestore.FieldValue }) {
  return { reference: input.ref, value: { type: "mention", recipientEmail: input.recipient.email ?? null, recipientUserId: input.recipient.userId, projectId: input.projectId, taskId: input.taskId, commentId: input.commentId, templateData: { projectName: input.projectName, authorName: input.authorName, contextLabel: input.taskTitle, targetUrl: `${parseApplicationUrl(process.env)}/projects/${input.projectId}/todos#task-${input.taskId}` }, status: "queued", idempotencyKey: `task-comment/${input.commentId}/${input.recipient.userId}`, providerMessageId: null, providerStatus: null, providerEventAt: null, attemptCount: 0, lastErrorCode: null, claimId: null, claimExpiresAt: null, nextAttemptAt: null, createdAt: input.now, updatedAt: input.now } };
}

export async function createTaskComment(actor: AuthActor, org: string, projectId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = createTaskCommentCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const ref = db.collection(`${taskPath(org, projectId, command.taskId)}/comments`).doc();
  const result = await executeAuditedCommand<{ id: string; notificationIds: string[]; audience: TaskCommentAudience }>({ db, auditRepository: dependencies.auditRepository, organizationId: org, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "task.comment.created", target: { type: "comment", id: ref.id }, correlation, changes: (value) => [{ field: "commentAudience", to: value.audience }], additionalSuccessAudits: (value) => value.notificationIds.map((id) => ({ action: "notification.email.queued", target: { type: "notification", id }, changes: [{ field: "deliveryStatus", to: "queued" }] })), execute: async (transaction) => {
    const current = await access(transaction, db, org, projectId, command.taskId, actor.uid); let audience = command.audience; let audienceUserIds = audience === "selected" ? command.audienceUserIds : []; let parent: TaskComment | null = null; let rootCommentId: string | null = null;
    if (command.parentCommentId) {
      const parentDoc = await transaction.get(db.doc(commentPath(org, projectId, command.taskId, command.parentCommentId))); parent = parentDoc.exists ? taskCommentSchema.parse({ id: parentDoc.id, ...parentDoc.data() }) : null;
      if (!parent || parent.deletedAt || !canReadTaskComment(parent, current.task, current.member, current.assignment)) throw new AuditedCommandError("denied", "task_comment_reply_denied", "Replying is unavailable");
      const rootId = parent.rootCommentId ?? parent.id; const rootDoc = rootId === parent.id ? parentDoc : await transaction.get(db.doc(commentPath(org, projectId, command.taskId, rootId))); const root = rootId === parent.id ? parent : rootDoc.exists ? taskCommentSchema.parse({ id: rootDoc.id, ...rootDoc.data() }) : null;
      if (!root) throw new AuditedCommandError("failed", "task_comment_root_missing", "Comment thread unavailable"); audience = root.audience; audienceUserIds = root.audienceUserIds; rootCommentId = root.id;
    }
    validateAudience(current.member, current.task, audience, audienceUserIds);
    const candidateIds = [...new Set([...audienceUserIds, ...command.mentionedUserIds, ...(parent ? [parent.authorId] : [])])].filter((id) => id !== actor.uid);
    const resolved = await Promise.all(candidateIds.map(async (id) => ({ id, value: await participant(transaction, db, org, projectId, id) })));
    if (audience === "selected" && audienceUserIds.some((id) => id !== actor.uid && (!resolved.find((item) => item.id === id)?.value || resolved.find((item) => item.id === id)?.value?.member.role === "client"))) throw new AuditedCommandError("denied", "task_comment_recipient_denied", "A selected person cannot access this discussion");
    const now = FieldValue.serverTimestamp(); const stored = { taskId: command.taskId, body: command.body, authorId: actor.uid, authorName: actorName(actor), audienceOwnerId: parent ? parent.audienceOwnerId : actor.uid, parentCommentId: parent?.id ?? null, rootCommentId, audience, audienceUserIds, mentionedUserIds: command.mentionedUserIds, createdAt: now, updatedAt: now, editedAt: null, deletedAt: null, deletedBy: null };
    const readable: TaskComment = { id: ref.id, ...stored, createdAt: { seconds: 0, nanoseconds: 0 }, updatedAt: { seconds: 0, nanoseconds: 0 } };
    const notifications = resolved.filter((item): item is { id: string; value: { member: OrganizationMember; assignment: ProjectAssignment | null } } => Boolean(item.value)).filter(({ value }) => value.member.email && canReadTaskComment(readable, current.task, value.member, value.assignment)).map(({ value }) => { const key = createHash("sha256").update(`${ref.id}:${value.member.userId}`).digest("hex").slice(0, 40); return notificationValue({ ref: db.doc(`organizations/${org}/notifications/task-comment-${key}`), recipient: value.member, projectId, projectName: current.project.name, taskId: current.task.id, taskTitle: current.task.title, commentId: ref.id, authorName: actorName(actor), now }); });
    transaction.create(ref, stored); notifications.forEach((notification) => transaction.create(notification.reference, notification.value)); return { id: ref.id, notificationIds: notifications.map((item) => item.reference.id), audience };
  }});
  await Promise.allSettled(result.notificationIds.map((id) => (dependencies.deliver ?? deliverNotification)(org, id, { db }))); return result;
}

export async function updateTaskComment(actor: AuthActor, org: string, projectId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = updateTaskCommentCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const ref = db.doc(commentPath(org, projectId, command.taskId, command.commentId));
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId: org, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "task.comment.updated", target: { type: "comment", id: command.commentId }, correlation, execute: async (transaction) => { const current = await access(transaction, db, org, projectId, command.taskId, actor.uid); const snap = await transaction.get(ref); const comment = snap.exists ? taskCommentSchema.parse({ id: snap.id, ...snap.data() }) : null; if (!comment || comment.deletedAt || (comment.authorId !== actor.uid && !current.moderator) || !canReadTaskComment(comment, current.task, current.member, current.assignment)) throw new AuditedCommandError("denied", "task_comment_edit_denied", "Comment editing denied"); transaction.update(ref, { body: command.body, mentionedUserIds: command.mentionedUserIds, editedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); } });
}

export async function deleteTaskComment(actor: AuthActor, org: string, projectId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = deleteTaskCommentCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const ref = db.doc(commentPath(org, projectId, command.taskId, command.commentId));
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId: org, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "task.comment.deleted", target: { type: "comment", id: command.commentId }, correlation, changes: [{ field: "status", to: "deleted" }], execute: async (transaction) => { const current = await access(transaction, db, org, projectId, command.taskId, actor.uid); const snap = await transaction.get(ref); const comment = snap.exists ? taskCommentSchema.parse({ id: snap.id, ...snap.data() }) : null; if (!comment || comment.deletedAt || (comment.authorId !== actor.uid && !current.moderator) || !canReadTaskComment(comment, current.task, current.member, current.assignment)) throw new AuditedCommandError("denied", "task_comment_delete_denied", "Comment deletion denied"); transaction.update(ref, { body: "", mentionedUserIds: [], deletedAt: FieldValue.serverTimestamp(), deletedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }); } });
}
