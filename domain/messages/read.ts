import "server-only";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { canAccessProject } from "@/domain/organizations/policy";
import { organizationMemberSchema, projectAssignmentSchema } from "@/domain/organizations/schemas";
import { messageCommentSchema, messagePostSchema, type MessageBoardPost } from "@/domain/messages/schemas";
import { canReadVisibleRecord } from "@/domain/visibility/policy";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function readMessageBoard(actor: AuthActor, organizationId: string, projectId: string, includeArchived = false, before: string | null = null, db: Firestore = getAdminDb()) {
  const [memberDoc, assignmentDoc] = await Promise.all([db.doc(`organizations/${organizationId}/members/${actor.uid}`).get(), db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${actor.uid}`).get()]);
  const member = memberDoc.exists ? organizationMemberSchema.parse(memberDoc.data()) : null; const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
  if (!canAccessProject(member, assignment)) return null;
  let query: FirebaseFirestore.Query = includeArchived
    ? db.collection(`organizations/${organizationId}/projects/${projectId}/messages`).where("archivedAt", "!=", null).orderBy("archivedAt", "desc").limit(50)
    : db.collection(`organizations/${organizationId}/projects/${projectId}/messages`).where("archivedAt", "==", null).orderBy("createdAt", "desc").limit(50);
  if (member?.role === "client") query = query.where("visibility", "==", "client-visible");
  if (before) { const cursor = new Date(before); if (!Number.isNaN(cursor.getTime())) query = query.startAfter(Timestamp.fromDate(cursor)); }
  const postsSnapshot = await query.get();
  const posts = postsSnapshot.docs.map((doc) => messagePostSchema.parse({ id: doc.id, ...doc.data() })).filter((post) => canReadVisibleRecord(member, assignment, post.visibility));
  const comments = await Promise.all(posts.map(async (post) => {
    const snapshot = await db.collection(`organizations/${organizationId}/projects/${projectId}/messages/${post.id}/comments`).where("archivedAt", "==", null).orderBy("createdAt", "asc").limit(100).get();
    return snapshot.docs.map((doc) => messageCommentSchema.parse({ id: doc.id, ...doc.data() })).filter((comment) => canReadVisibleRecord(member, assignment, comment.visibility));
  }));
  const iso = (value: { seconds: number }) => new Date(value.seconds * 1000).toISOString();
  const result: MessageBoardPost[] = posts.map((post, index) => ({ ...post, createdAt: iso(post.createdAt), updatedAt: iso(post.updatedAt), editedAt: post.editedAt ? iso(post.editedAt) : null, archivedAt: post.archivedAt ? iso(post.archivedAt) : null, pinnedAt: post.pinnedAt ? iso(post.pinnedAt) : null, comments: comments[index].map((comment) => ({ ...comment, createdAt: iso(comment.createdAt), updatedAt: iso(comment.updatedAt), editedAt: comment.editedAt ? iso(comment.editedAt) : null, archivedAt: comment.archivedAt ? iso(comment.archivedAt) : null })) }));
  result.sort((a, b) => Number(Boolean(b.pinnedAt)) - Number(Boolean(a.pinnedAt)) || b.createdAt.localeCompare(a.createdAt));
  const last = posts.at(-1); const nextCursor = posts.length === 50 && last ? iso(includeArchived ? last.archivedAt! : last.createdAt) : null;
  return { posts: result, nextCursor, member: { userId: member!.userId, role: member!.role, name: actor.displayName?.trim() || actor.email || "A teammate" }, canCreatePosts: member!.role !== "client", canModerate: member!.role === "admin" || assignment?.projectRole === "admin" };
}
