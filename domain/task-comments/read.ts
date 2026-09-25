import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { canAccessProject } from "@/domain/organizations/policy";
import { organizationMemberSchema, projectAssignmentSchema } from "@/domain/organizations/schemas";
import { projectTaskSchema } from "@/domain/tasks/schemas";
import { canModerateTaskComments, canReadTaskComment } from "@/domain/task-comments/policy";
import { taskCommentSchema, type TaskCommentView } from "@/domain/task-comments/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

const iso = (value: { seconds: number; nanoseconds: number } | null) => value ? new Date(value.seconds * 1000 + value.nanoseconds / 1e6).toISOString() : null;

export async function readTaskComments(actor: AuthActor, organizationId: string, projectId: string, taskId: string, db: Firestore = getAdminDb()) {
  const [memberDoc, assignmentDoc, taskDoc] = await Promise.all([
    db.doc(`organizations/${organizationId}/members/${actor.uid}`).get(), db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${actor.uid}`).get(), db.doc(`organizations/${organizationId}/projects/${projectId}/tasks/${taskId}`).get(),
  ]);
  const member = memberDoc.exists ? organizationMemberSchema.parse(memberDoc.data()) : null; const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
  if (!member || !canAccessProject(member, assignment) || !taskDoc.exists) return null;
  const task = projectTaskSchema.parse({ id: taskDoc.id, ...taskDoc.data() });
  if (member.role === "client" && (task.visibility !== "client-visible" || task.archivedAt)) return null;
  const snapshot = await db.collection(`organizations/${organizationId}/projects/${projectId}/tasks/${taskId}/comments`).orderBy("createdAt", "asc").limit(300).get();
  const moderate = canModerateTaskComments(member, assignment);
  const comments: TaskCommentView[] = snapshot.docs.map((doc) => taskCommentSchema.parse({ id: doc.id, ...doc.data() })).filter((comment) => canReadTaskComment(comment, task, member!, assignment)).map((comment) => ({ ...comment, body: comment.deletedAt ? "" : comment.body, mentionedUserIds: comment.deletedAt || member.role === "client" ? [] : comment.mentionedUserIds, createdAt: iso(comment.createdAt)!, updatedAt: iso(comment.updatedAt)!, editedAt: iso(comment.editedAt), deletedAt: iso(comment.deletedAt), canEdit: !comment.deletedAt && (comment.authorId === actor.uid || moderate), canDelete: !comment.deletedAt && (comment.authorId === actor.uid || moderate) }));
  return { comments, viewer: { userId: actor.uid, name: member.displayName?.trim() || member.email || actor.displayName || actor.email || "You", role: member.role, canModerate: moderate }, task: { id: task.id, title: task.title, visibility: task.visibility, assigneeIds: member.role === "client" ? [] : task.assigneeIds } };
}
