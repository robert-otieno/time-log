import "server-only";
import type { Auth, UserRecord } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { canAccessProject } from "@/domain/organizations/policy";
import { organizationMemberSchema, projectAssignmentSchema, type OrganizationMember } from "@/domain/organizations/schemas";
import { TaskRepository } from "@/domain/tasks/repository";
import { visibilityForQuery } from "@/domain/visibility/policy";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

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

async function getDirectoryUsers(
  userIds: string[],
  auth: Pick<Auth, "getUsers">,
): Promise<Map<string, UserRecord>> {
  const batches = Array.from(
    { length: Math.ceil(userIds.length / 100) },
    (_, index) => userIds.slice(index * 100, (index + 1) * 100),
  );
  const results = await Promise.all(
    batches.map(async (batch) => {
      try {
        return (await auth.getUsers(batch.map((uid) => ({ uid })))).users;
      } catch {
        return [];
      }
    }),
  );
  return new Map(results.flat().map((user) => [user.uid, user]));
}

export async function listEligibleTaskAssignees(actor: AuthActor, organizationId: string, projectId: string, member: OrganizationMember, db: Firestore = getAdminDb(), auth: Pick<Auth, "getUsers"> = getAdminAuth()): Promise<TaskAssigneeOption[]> {
  if (member.role === "client") return [];
  const members = await db.collection(`organizations/${organizationId}/members`).where("status", "==", "active").get();
  const internal = members.docs.map((document) => organizationMemberSchema.parse(document.data())).filter((candidate) => candidate.role !== "client");
  const eligible = await Promise.all(internal.map(async (candidate) => {
    if (candidate.role === "admin") return candidate;
    const assignment = await db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${candidate.userId}`).get();
    return assignment.exists && assignment.data()?.status === "active" ? candidate : null;
  }));
  const eligibleMembers = eligible.filter((candidate): candidate is OrganizationMember => candidate !== null);
  const unresolvedIds = eligibleMembers
    .filter((candidate) => !candidate.displayName && candidate.userId !== actor.uid)
    .map((candidate) => candidate.userId);
  const directoryUsers = await getDirectoryUsers(unresolvedIds, auth);
  return eligibleMembers
    .map((candidate) => {
      const directoryUser = directoryUsers.get(candidate.userId);
      const displayName = candidate.displayName?.trim()
        || (candidate.userId === actor.uid ? actor.displayName?.trim() : null)
        || directoryUser?.displayName?.trim()
        || candidate.email
        || (candidate.userId === actor.uid ? actor.email : null)
        || directoryUser?.email
        || candidate.userId;
      return {
        id: candidate.userId,
        name: displayName,
        email: candidate.email
          ?? (candidate.userId === actor.uid ? actor.email : null)
          ?? directoryUser?.email
          ?? null,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
