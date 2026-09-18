import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { canAccessProject } from "@/domain/organizations/policy";
import { organizationMemberSchema, projectAssignmentSchema, type OrganizationMember } from "@/domain/organizations/schemas";
import { TaskRepository } from "@/domain/tasks/repository";
import { visibilityForQuery } from "@/domain/visibility/policy";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

export type TaskAssigneeOption = { id: string; name: string; email: string | null };

export async function listTasksForViewer(actor: AuthActor, organizationId: string, projectId: string, db: Firestore = getAdminDb()) {
  const [memberDoc, assignmentDoc] = await Promise.all([
    db.doc(`organizations/${organizationId}/members/${actor.uid}`).get(),
    db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${actor.uid}`).get(),
  ]);
  const member = memberDoc.exists ? organizationMemberSchema.parse(memberDoc.data()) : null;
  const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
  if (!canAccessProject(member, assignment)) return null;
  const tasks = await new TaskRepository(db).list(organizationId, projectId, { includeArchived: member?.role !== "client" }, visibilityForQuery(member));
  return { member: member!, tasks };
}

export async function listEligibleTaskAssignees(actor: AuthActor, organizationId: string, projectId: string, member: OrganizationMember, db: Firestore = getAdminDb()): Promise<TaskAssigneeOption[]> {
  if (member.role === "client") return [];
  const members = await db.collection(`organizations/${organizationId}/members`).where("status", "==", "active").get();
  const internal = members.docs.map((document) => organizationMemberSchema.parse(document.data())).filter((candidate) => candidate.role !== "client");
  const eligible = await Promise.all(internal.map(async (candidate) => {
    if (candidate.role === "admin") return candidate;
    const assignment = await db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${candidate.userId}`).get();
    return assignment.exists && assignment.data()?.status === "active" ? candidate : null;
  }));
  return eligible.filter((candidate): candidate is OrganizationMember => candidate !== null).map((candidate) => ({ id: candidate.userId, name: candidate.displayName ?? candidate.email ?? "Team member", email: candidate.email ?? null }));
}
