import "server-only";

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { hasCapability } from "@/domain/organizations/policy";
import { clientSchema, invitationSchema, organizationMemberSchema, organizationSchema, projectSchema } from "@/domain/organizations/schemas";
import { acceptInvitationCommandSchema, createInvitationCommandSchema, membershipAccessCommandSchema } from "@/domain/invitations/schemas";
import { createInvitationToken, hashInvitationToken, normalizeInvitationEmail } from "@/domain/invitations/tokens";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseApplicationUrl } from "@/lib/resend-config";

type Dependencies = { db?: Firestore; auditRepository?: AuditWriter };
type CreateInvitationResult = { invitationId: string; notificationId: string; token: string; clientCreated: boolean; clientId: string | null };

export async function createInvitation(actor: AuthActor, organizationId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = createInvitationCommandSchema.parse(raw);
  const db = dependencies.db ?? getAdminDb();
  const token = createInvitationToken();
  const invitationRef = db.collection(`organizations/${organizationId}/invitations`).doc();
  const notificationRef = db.doc(`organizations/${organizationId}/notifications/${invitationRef.id}`);
  const organizationRef = db.doc(`organizations/${organizationId}`);
  const actorRef = db.doc(`organizations/${organizationId}/members/${actor.uid}`);
  const clientRef = command.client.mode === "existing"
    ? db.doc(`organizations/${organizationId}/clients/${command.client.clientId}`)
    : command.client.mode === "create" ? db.collection(`organizations/${organizationId}/clients`).doc() : null;
  const projectRefs = command.projectIds.map((id) => db.doc(`organizations/${organizationId}/projects/${id}`));
  const email = normalizeInvitationEmail(command.email);
  const appUrl = parseApplicationUrl(process.env);

  const result = await executeAuditedCommand<CreateInvitationResult>({
    db, auditRepository: dependencies.auditRepository, organizationId, projectId: null,
    actor: { type: "user", id: actor.uid, role: "admin" }, action: "organization.invitation.created",
    target: { type: "invitation", id: invitationRef.id }, correlation,
    changes: [{ field: "role", to: command.role }, { field: "status", to: "pending" }],
    additionalSuccessAudits: (result) => [
      { action: "notification.email.queued", target: { type: "notification", id: result.notificationId }, changes: [{ field: "deliveryStatus", to: "queued" }] },
      ...(result.clientCreated ? [{ action: "organization.client.created" as const, target: { type: "client" as const, id: result.clientId }, changes: [{ field: "status" as const, to: "active" }] }] : []),
    ],
    execute: async (transaction) => {
      const [organizationSnapshot, actorSnapshot, clientSnapshot, ...projectSnapshots] = await Promise.all([
        transaction.get(organizationRef), transaction.get(actorRef),
        clientRef ? transaction.get(clientRef) : Promise.resolve(null),
        ...projectRefs.map((reference) => transaction.get(reference)),
      ]);
      if (!organizationSnapshot.exists || !actorSnapshot.exists) throw new AuditedCommandError("denied", "organization_access_denied", "Organization access denied");
      const organization = organizationSchema.parse({ id: organizationSnapshot.id, ...organizationSnapshot.data() });
      const membership = organizationMemberSchema.parse(actorSnapshot.data());
      if (!hasCapability(membership, "members.manage")) throw new AuditedCommandError("denied", "members_manage_denied", "Member management denied");
      projectSnapshots.forEach((snapshot) => {
        if (!snapshot.exists) throw new AuditedCommandError("failed", "project_not_found", "A selected project was not found");
        const project = projectSchema.parse({ id: snapshot.id, ...snapshot.data() });
        if (project.status === "archived") throw new AuditedCommandError("denied", "project_archived", "Archived projects cannot receive assignments");
        if (command.role === "client" && project.clientId !== clientRef?.id) throw new AuditedCommandError("denied", "client_project_mismatch", "Client project mismatch");
      });
      if (command.client.mode === "existing" && (!clientSnapshot?.exists || clientSchema.parse({ id: clientSnapshot.id, ...clientSnapshot.data() }).status !== "active")) {
        throw new AuditedCommandError("failed", "client_not_found", "Client company not found");
      }
      const now = FieldValue.serverTimestamp();
      if (command.client.mode === "create" && clientRef) transaction.create(clientRef, { name: command.client.name, status: "active", createdBy: actor.uid, createdAt: now, updatedBy: actor.uid, updatedAt: now });
      transaction.create(invitationRef, {
        email, role: command.role, clientId: clientRef?.id ?? null, tokenHash: hashInvitationToken(token), status: "pending",
        projectIds: command.projectIds, expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000), acceptedBy: null, acceptedAt: null,
        createdBy: actor.uid, createdAt: now, updatedAt: now,
      });
      transaction.create(notificationRef, {
        type: "invitation", recipientEmail: email,
        templateData: { organizationName: organization.name, inviterName: actor.displayName?.trim() || "An administrator", acceptUrl: `${appUrl}/invitations/${organizationId}/${invitationRef.id}?token=${encodeURIComponent(token)}` },
        status: "queued", idempotencyKey: `invitation/${invitationRef.id}`, providerMessageId: null, attemptCount: 0, lastErrorCode: null,
        createdAt: now, updatedAt: now,
      });
      return { invitationId: invitationRef.id, notificationId: notificationRef.id, token, clientCreated: command.client.mode === "create", clientId: clientRef?.id ?? null };
    },
  });
  return result;
}

export async function acceptInvitation(actor: AuthActor, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = acceptInvitationCommandSchema.parse(raw);
  const db = dependencies.db ?? getAdminDb();
  const invitationRef = db.doc(`organizations/${command.organizationId}/invitations/${command.invitationId}`);
  const memberRef = db.doc(`organizations/${command.organizationId}/members/${actor.uid}`);
  const selectionRef = db.doc(`users/${actor.uid}/preferences/workspace`);
  return executeAuditedCommand({
    db, auditRepository: dependencies.auditRepository, organizationId: command.organizationId, projectId: null,
    actor: { type: "user", id: actor.uid, role: null }, action: "organization.invitation.accepted",
    target: { type: "invitation", id: command.invitationId }, correlation,
    changes: [{ field: "status", to: "accepted" }],
    execute: async (transaction) => {
      const invitationSnapshot = await transaction.get(invitationRef);
      if (!invitationSnapshot.exists) throw new AuditedCommandError("denied", "invitation_invalid", "Invitation invalid");
      const invitation = invitationSchema.parse({ id: invitationSnapshot.id, ...invitationSnapshot.data() });
      if (invitation.status !== "pending" || invitation.expiresAt.seconds * 1000 <= Date.now() || invitation.tokenHash !== hashInvitationToken(command.token)) throw new AuditedCommandError("denied", "invitation_invalid", "Invitation invalid");
      if (!actor.emailVerified || !actor.email || normalizeInvitationEmail(actor.email) !== invitation.email) throw new AuditedCommandError("denied", "invitation_email_mismatch", "Sign in with the invited email address");
      const [existingMember] = await Promise.all([transaction.get(memberRef), transaction.get(selectionRef)]);
      if (existingMember.exists && organizationMemberSchema.parse(existingMember.data()).status === "active") throw new AuditedCommandError("failed", "membership_already_active", "Membership is already active");
      const assignmentRefs = invitation.projectIds.map((projectId) => db.doc(`organizations/${command.organizationId}/projects/${projectId}/projectMembers/${actor.uid}`));
      const assignmentSnapshots = await Promise.all(assignmentRefs.map((reference) => transaction.get(reference)));
      const now = FieldValue.serverTimestamp();
      transaction.set(memberRef, { userId: actor.uid, email: normalizeInvitationEmail(actor.email), displayName: actor.displayName?.trim() || null, role: invitation.role, status: "active", clientId: invitation.clientId, joinedAt: now });
      assignmentRefs.forEach((reference, index) => transaction.set(reference, { userId: actor.uid, status: "active", assignedBy: invitation.createdBy, assignedAt: assignmentSnapshots[index].exists ? assignmentSnapshots[index].data()?.assignedAt ?? now : now, removedAt: null }));
      transaction.update(invitationRef, { status: "accepted", acceptedBy: actor.uid, acceptedAt: now, updatedAt: now });
      transaction.set(selectionRef, { activeOrganizationId: command.organizationId, source: "user", updatedAt: now }, { merge: true });
      return { organizationId: command.organizationId };
    },
  });
}

export async function changeMembershipAccess(actor: AuthActor, organizationId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = membershipAccessCommandSchema.parse(raw);
  const db = dependencies.db ?? getAdminDb();
  const actorRef = db.doc(`organizations/${organizationId}/members/${actor.uid}`);
  const targetRef = db.doc(`organizations/${organizationId}/members/${command.userId}`);
  const projects = command.action === "remove"
    ? await db.collection(`organizations/${organizationId}/projects`).select().get()
    : null;
  const assignmentRefs = projects?.docs.map((project) => db.doc(`organizations/${organizationId}/projects/${project.id}/projectMembers/${command.userId}`)) ?? [];
  const targetStatus = command.action === "restore" ? "active" : command.action === "suspend" ? "suspended" : "removed";
  const action = command.action === "restore" ? "organization.membership.restored" : command.action === "suspend" ? "organization.membership.suspended" : "organization.membership.removed";
  return executeAuditedCommand({
    db, auditRepository: dependencies.auditRepository, organizationId, projectId: null,
    actor: { type: "user", id: actor.uid, role: "admin" }, action,
    target: { type: "membership", id: command.userId }, correlation,
    changes: [{ field: "membershipStatus", to: targetStatus }],
    execute: async (transaction) => {
      const [actorSnapshot, targetSnapshot, ...assignmentSnapshots] = await Promise.all([transaction.get(actorRef), transaction.get(targetRef), ...assignmentRefs.map((reference) => transaction.get(reference))]);
      if (!actorSnapshot.exists || !targetSnapshot.exists) throw new AuditedCommandError("denied", "membership_access_denied", "Membership access denied");
      const actingMember = organizationMemberSchema.parse(actorSnapshot.data());
      const targetMember = organizationMemberSchema.parse(targetSnapshot.data());
      if (!hasCapability(actingMember, "members.manage")) throw new AuditedCommandError("denied", "members_manage_denied", "Member management denied");
      if (targetMember.status === "removed" || (command.action === "restore" && targetMember.status !== "suspended")) throw new AuditedCommandError("failed", "membership_state_invalid", "Membership state is invalid");
      if (targetMember.role === "admin" && targetMember.status === "active" && command.action !== "restore") {
        const admins = await transaction.get(db.collection(`organizations/${organizationId}/members`).where("role", "==", "admin").where("status", "==", "active"));
        if (admins.size <= 1) throw new AuditedCommandError("denied", "last_admin_required", "The final active admin cannot lose access");
      }
      transaction.update(targetRef, { status: targetStatus });
      if (command.action === "remove") assignmentRefs.forEach((reference, index) => {
        if (assignmentSnapshots[index].exists) transaction.update(reference, { status: "removed", removedAt: FieldValue.serverTimestamp() });
      });
      return { status: targetStatus };
    },
  });
}
