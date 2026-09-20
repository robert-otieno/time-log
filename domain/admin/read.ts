import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { AUDIT_SCHEMA_VERSION, auditEventSchema } from "@/domain/audit/schemas";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditRepository } from "@/domain/audit/repository";
import { hasCapability } from "@/domain/organizations/policy";
import { clientSchema, invitationSchema, organizationMemberSchema, organizationSchema, projectAssignmentSchema, projectSchema } from "@/domain/organizations/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function loadAdminConsole(actor: AuthActor, organizationId: string, correlation: AuditCorrelation, db: Firestore = getAdminDb()) {
  const [organizationSnapshot, actorSnapshot] = await Promise.all([db.doc(`organizations/${organizationId}`).get(), db.doc(`organizations/${organizationId}/members/${actor.uid}`).get()]);
  const membership = actorSnapshot.exists ? organizationMemberSchema.parse(actorSnapshot.data()) : null;
  if (!organizationSnapshot.exists || !hasCapability(membership, "organization.manage")) return null;
  const organization = organizationSchema.parse({ id: organizationSnapshot.id, ...organizationSnapshot.data() });
  const [membersSnapshot, clientsSnapshot, projectsSnapshot, invitationsSnapshot, auditSnapshot] = await Promise.all([
    db.collection(`organizations/${organizationId}/members`).get(), db.collection(`organizations/${organizationId}/clients`).get(), db.collection(`organizations/${organizationId}/projects`).get(), db.collection(`organizations/${organizationId}/invitations`).where("status", "==", "pending").get(), db.collection(`organizations/${organizationId}/auditEvents`).orderBy("occurredAt", "desc").limit(50).get(),
  ]);
  const projects = projectsSnapshot.docs.map((document) => projectSchema.parse({ id: document.id, ...document.data() }));
  const assignmentSnapshots = await Promise.all(projects.map((project) => db.collection(`organizations/${organizationId}/projects/${project.id}/projectMembers`).get()));
  const assignments = assignmentSnapshots.flatMap((snapshot, index) => snapshot.docs.map((document) => ({ projectId: projects[index].id, ...projectAssignmentSchema.parse(document.data()) })));
  await new AuditRepository(db).append({ organizationId, projectId: null, actor: { type: "user", id: actor.uid, role: "admin" }, action: "organization.admin.viewed", target: { type: "organization", id: organizationId }, outcome: "succeeded", changes: [], reasonCode: null, requestId: correlation.requestId, runId: correlation.runId, ipHash: null, userAgentSummary: null, schemaVersion: AUDIT_SCHEMA_VERSION });
  return {
    organization,
    members: membersSnapshot.docs.map((document) => organizationMemberSchema.parse(document.data())),
    clients: clientsSnapshot.docs.map((document) => clientSchema.parse({ id: document.id, ...document.data() })),
    projects,
    assignments,
    pendingInvitations: invitationsSnapshot.docs.map((document) => invitationSchema.parse({ id: document.id, ...document.data() })),
    recentAudit: auditSnapshot.docs.map((document) => auditEventSchema.parse({ id: document.id, ...document.data() })).filter((event) => event.action !== "organization.admin.viewed" && (event.action.startsWith("organization.") || event.action.startsWith("project.record.") || event.action.startsWith("project.assignment."))).slice(0, 12),
  };
}
