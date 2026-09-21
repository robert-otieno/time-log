import "server-only";

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { changeMemberRoleSchema, changeProjectAssignmentSchema, updateOrganizationSettingsSchema } from "@/domain/admin/schemas";
import { hasCapability } from "@/domain/organizations/policy";
import { organizationMemberSchema, organizationSchema, projectAssignmentSchema, projectSchema } from "@/domain/organizations/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

type Dependencies = { db?: Firestore; auditRepository?: AuditWriter };

async function requireAdmin(transaction: FirebaseFirestore.Transaction, db: Firestore, organizationId: string, userId: string) {
  const snapshot = await transaction.get(db.doc(`organizations/${organizationId}/members/${userId}`));
  const member = snapshot.exists ? organizationMemberSchema.parse(snapshot.data()) : null;
  if (!hasCapability(member, "organization.manage")) throw new AuditedCommandError("denied", "organization_manage_denied", "Organization management denied");
  return member!;
}

export async function updateOrganizationSettings(actor: AuthActor, organizationId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = updateOrganizationSettingsSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const organizationRef = db.doc(`organizations/${organizationId}`);
  return executeAuditedCommand<{ nameChanged: boolean; timezoneChanged: boolean }>({ db, auditRepository: dependencies.auditRepository, organizationId, projectId: null, actor: { type: "user", id: actor.uid, role: "admin" }, action: "organization.settings.updated", target: { type: "organization", id: organizationId }, correlation,
    changes: (result) => [{ field: "nameChanged", to: result.nameChanged }, { field: "timezoneChanged", to: result.timezoneChanged }],
    execute: async (transaction) => {
      await requireAdmin(transaction, db, organizationId, actor.uid); const snapshot = await transaction.get(organizationRef); if (!snapshot.exists) throw new AuditedCommandError("failed", "organization_not_found", "Organization not found");
      const organization = organizationSchema.parse({ id: snapshot.id, ...snapshot.data() }); const nameChanged = organization.name !== command.name; const timezoneChanged = organization.timezone !== command.timezone;
      if (nameChanged || timezoneChanged) transaction.update(organizationRef, { name: command.name, timezone: command.timezone, updatedAt: FieldValue.serverTimestamp() });
      return { nameChanged, timezoneChanged };
    },
  });
}

export async function changeMemberRole(actor: AuthActor, organizationId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = changeMemberRoleSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const targetRef = db.doc(`organizations/${organizationId}/members/${command.userId}`);
  const discoveredAssignments = command.role === "member"
    ? await db.collectionGroup("projectMembers").where("userId", "==", command.userId).where("status", "==", "active").get()
    : null;
  const projectIds = command.role === "member"
    ? discoveredAssignments!.docs
        .map((assignment) => assignment.ref.parent.parent)
        .filter((project): project is FirebaseFirestore.DocumentReference => project !== null && project.parent.parent?.id === organizationId)
        .map((project) => project.id)
    : command.projectIds;
  const projectRefs = projectIds.map((projectId) => db.doc(`organizations/${organizationId}/projects/${projectId}`));
  const assignmentRefs = projectIds.map((projectId) => db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${command.userId}`));
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId: null, actor: { type: "user", id: actor.uid, role: "admin" }, action: "organization.membership.role.changed", target: { type: "membership", id: command.userId }, correlation, changes: [{ field: "role", to: command.role }],
    execute: async (transaction) => {
      await requireAdmin(transaction, db, organizationId, actor.uid);
      const [targetSnapshot, ...projectSnapshots] = await Promise.all([transaction.get(targetRef), ...projectRefs.map((reference) => transaction.get(reference))]);
      if (!targetSnapshot.exists) throw new AuditedCommandError("failed", "membership_not_found", "Membership not found");
      const target = organizationMemberSchema.parse(targetSnapshot.data()); if (target.status !== "active" || target.role === "client") throw new AuditedCommandError("denied", "membership_role_denied", "Role change denied");
      if (target.role === "admin" && command.role !== "admin") { const admins = await transaction.get(db.collection(`organizations/${organizationId}/members`).where("role", "==", "admin").where("status", "==", "active")); if (admins.size <= 1) throw new AuditedCommandError("denied", "last_admin_required", "The final active admin cannot be demoted"); }
      if (projectSnapshots.some((snapshot) => !snapshot.exists)) throw new AuditedCommandError("failed", "project_not_found", "A selected project was not found");
      const assignmentSnapshots = await Promise.all(assignmentRefs.map((reference) => transaction.get(reference)));
      const now = FieldValue.serverTimestamp();
      const membershipRole = command.role === "admin" ? "admin" : "member";
      if (target.role !== membershipRole) transaction.update(targetRef, { role: membershipRole });
      assignmentRefs.forEach((reference, index) => {
        const existing = assignmentSnapshots[index].exists ? projectAssignmentSchema.parse(assignmentSnapshots[index].data()) : null;
        transaction.set(reference, {
          userId: command.userId,
          projectRole: command.role === "project_admin" ? "admin" : "member",
          status: "active",
          assignedBy: actor.uid,
          assignedAt: existing?.assignedAt ?? now,
          removedAt: null,
        });
      });
      return { role: command.role };
    },
  });
}

export async function changeProjectAssignment(actor: AuthActor, organizationId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = changeProjectAssignmentSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const projectRef = db.doc(`organizations/${organizationId}/projects/${command.projectId}`); const targetRef = db.doc(`organizations/${organizationId}/members/${command.userId}`); const assignmentRef = db.doc(`organizations/${organizationId}/projects/${command.projectId}/projectMembers/${command.userId}`);
  const assigning = command.action === "assign";
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId: command.projectId, actor: { type: "user", id: actor.uid, role: "admin" }, action: assigning ? "project.assignment.created" : "project.assignment.removed", target: { type: "membership", id: command.userId }, correlation, changes: [{ field: "membershipStatus", to: assigning ? "active" : "removed" }],
    execute: async (transaction) => {
      await requireAdmin(transaction, db, organizationId, actor.uid); const [projectSnapshot, targetSnapshot, assignmentSnapshot] = await Promise.all([transaction.get(projectRef), transaction.get(targetRef), transaction.get(assignmentRef)]);
      if (!projectSnapshot.exists || !targetSnapshot.exists) throw new AuditedCommandError("failed", "assignment_target_not_found", "Assignment target not found");
      const project = projectSchema.parse({ id: projectSnapshot.id, ...projectSnapshot.data() }); const target = organizationMemberSchema.parse(targetSnapshot.data()); const assignment = assignmentSnapshot.exists ? projectAssignmentSchema.parse(assignmentSnapshot.data()) : null;
      if (target.status !== "active") throw new AuditedCommandError("denied", "membership_inactive", "Inactive members cannot receive project access");
      if (assigning && project.status === "archived") throw new AuditedCommandError("denied", "project_archived", "Archived projects cannot receive assignments");
      if (assigning && target.role === "client" && (!target.clientId || project.clientId !== target.clientId)) throw new AuditedCommandError("denied", "client_project_mismatch", "Client project mismatch");
      const now = FieldValue.serverTimestamp();
      if (assigning) transaction.set(assignmentRef, { userId: command.userId, projectRole: command.projectRole, status: "active", assignedBy: actor.uid, assignedAt: assignment?.assignedAt ?? now, removedAt: null });
      else if (assignment?.status === "active") transaction.update(assignmentRef, { status: "removed", removedAt: now });
      else throw new AuditedCommandError("failed", "assignment_state_invalid", "Assignment is not active");
      return { status: assigning ? "active" : "removed" };
    },
  });
}
