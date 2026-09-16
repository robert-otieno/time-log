import "server-only";

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { hasCapability } from "@/domain/organizations/policy";
import { clientSchema, organizationMemberSchema, projectSchema, type Project } from "@/domain/organizations/schemas";
import { changeProjectStatusCommandSchema, createProjectCommandSchema, selectProjectCommandSchema, updateProjectCommandSchema } from "@/domain/projects/schemas";
import { projectKeyBase, projectKeyCandidate } from "@/domain/projects/keys";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

type Dependencies = { db?: Firestore; auditRepository?: AuditWriter };

async function requireAdmin(transaction: FirebaseFirestore.Transaction, db: Firestore, organizationId: string, uid: string) {
  const snapshot = await transaction.get(db.doc(`organizations/${organizationId}/members/${uid}`));
  const member = snapshot.exists ? organizationMemberSchema.parse(snapshot.data()) : null;
  if (!hasCapability(member, "projects.manage")) throw new AuditedCommandError("denied", "projects_manage_denied", "Project management denied");
  return member!;
}

export async function createProject(actor: AuthActor, organizationId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = createProjectCommandSchema.parse(raw);
  const db = dependencies.db ?? getAdminDb();
  const projectRef = db.collection(`organizations/${organizationId}/projects`).doc();
  const keyBase = projectKeyBase(command.name);
  return executeAuditedCommand<Project>({
    db, auditRepository: dependencies.auditRepository, organizationId, projectId: projectRef.id,
    actor: { type: "user", id: actor.uid, role: "admin" }, action: "project.record.created", target: { type: "project", id: projectRef.id }, correlation,
    changes: [{ field: "projectStatus", to: "active" }],
    execute: async (transaction) => {
      await requireAdmin(transaction, db, organizationId, actor.uid);
      if (command.clientId) {
        const client = await transaction.get(db.doc(`organizations/${organizationId}/clients/${command.clientId}`));
        if (!client.exists || clientSchema.parse({ id: client.id, ...client.data() }).status !== "active") throw new AuditedCommandError("failed", "client_not_found", "Client not found");
      }
      let key = keyBase;
      for (let attempt = 0; attempt < 100; attempt++) {
        key = projectKeyCandidate(keyBase, attempt);
        const matches = await transaction.get(db.collection(`organizations/${organizationId}/projects`).where("key", "==", key).limit(1));
        if (matches.empty) break;
        if (attempt === 99) throw new AuditedCommandError("failed", "project_key_exhausted", "Project key unavailable");
      }
      const now = FieldValue.serverTimestamp();
      transaction.create(projectRef, { ...command, key, status: "active", defaultVisibility: "internal", templateSource: null, createdBy: actor.uid, createdAt: now, updatedBy: actor.uid, updatedAt: now });
      return projectSchema.parse({ id: projectRef.id, ...command, key, status: "active", defaultVisibility: "internal", templateSource: null, createdBy: actor.uid, createdAt: { seconds: 0, nanoseconds: 0 }, updatedBy: actor.uid, updatedAt: { seconds: 0, nanoseconds: 0 } });
    },
  });
}

export async function updateProject(actor: AuthActor, organizationId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = updateProjectCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb();
  const reference = db.doc(`organizations/${organizationId}/projects/${command.projectId}`);
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId: command.projectId, actor: { type: "user", id: actor.uid, role: "admin" }, action: "project.record.updated", target: { type: "project", id: command.projectId }, correlation, changes: [{ field: "enabled", to: true }], execute: async (transaction) => {
    await requireAdmin(transaction, db, organizationId, actor.uid); const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new AuditedCommandError("failed", "project_not_found", "Project not found");
    const existing = projectSchema.parse({ id: snapshot.id, ...snapshot.data() });
    if (existing.status !== "active") throw new AuditedCommandError("denied", "project_read_only", "Restore the project before editing");
    if (command.clientId) {
      const client = await transaction.get(db.doc(`organizations/${organizationId}/clients/${command.clientId}`));
      if (!client.exists || clientSchema.parse({ id: client.id, ...client.data() }).status !== "active") throw new AuditedCommandError("failed", "client_not_found", "Client not found");
    }
    transaction.update(reference, { name: command.name, description: command.description, clientId: command.clientId, enabledTools: command.enabledTools, updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() });
  }});
}

export async function changeProjectStatus(actor: AuthActor, organizationId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = changeProjectStatusCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const reference = db.doc(`organizations/${organizationId}/projects/${command.projectId}`);
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId: command.projectId, actor: { type: "user", id: actor.uid, role: "admin" }, action: command.status === "archived" ? "project.record.archived" : "project.record.updated", target: { type: "project", id: command.projectId }, correlation, changes: [{ field: "projectStatus", to: command.status }], execute: async (transaction) => { await requireAdmin(transaction, db, organizationId, actor.uid); const snapshot = await transaction.get(reference); if (!snapshot.exists) throw new AuditedCommandError("failed", "project_not_found", "Project not found"); transaction.update(reference, { status: command.status, updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }); }});
}

export async function listAccessibleProjects(actor: AuthActor, organizationId: string, db: Firestore = getAdminDb()) {
  const membershipSnapshot = await db.doc(`organizations/${organizationId}/members/${actor.uid}`).get();
  const member = membershipSnapshot.exists ? organizationMemberSchema.parse(membershipSnapshot.data()) : null;
  if (!member || member.status !== "active" || member.role === "client") return null;
  const projects = await db.collection(`organizations/${organizationId}/projects`).get();
  if (member.role === "admin") return projects.docs.map((document) => projectSchema.parse({ id: document.id, ...document.data() }));
  const assignments = await Promise.all(projects.docs.map((project) => db.doc(`${project.ref.path}/projectMembers/${actor.uid}`).get()));
  return projects.docs.filter((_, index) => assignments[index].data()?.status === "active").map((document) => projectSchema.parse({ id: document.id, ...document.data() }));
}

export async function getAccessibleProject(actor: AuthActor, organizationId: string, projectId: string, db: Firestore = getAdminDb()) {
  const [membershipSnapshot, projectSnapshot, assignmentSnapshot] = await Promise.all([
    db.doc(`organizations/${organizationId}/members/${actor.uid}`).get(),
    db.doc(`organizations/${organizationId}/projects/${projectId}`).get(),
    db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${actor.uid}`).get(),
  ]);
  const member = membershipSnapshot.exists ? organizationMemberSchema.parse(membershipSnapshot.data()) : null;
  if (!member || member.status !== "active" || member.role === "client" || !projectSnapshot.exists) return null;
  if (member.role !== "admin" && assignmentSnapshot.data()?.status !== "active") return null;
  return { project: projectSchema.parse({ id: projectSnapshot.id, ...projectSnapshot.data() }), role: member.role };
}

export async function selectActiveProject(actor: AuthActor, organizationId: string, raw: unknown, dependencies: Dependencies = {}) {
  const command = selectProjectCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb();
  const projects = await listAccessibleProjects(actor, organizationId, db);
  if (!projects?.some((project) => project.id === command.projectId && project.status !== "archived")) throw new AuditedCommandError("denied", "project_access_denied", "Project access denied");
  await db.doc(`users/${actor.uid}/preferences/workspace`).set({ activeOrganizationId: organizationId, activeProjectId: command.projectId, source: "user", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function listActiveProjectClients(actor: AuthActor, organizationId: string, db: Firestore = getAdminDb()) {
  const membership = await db.doc(`organizations/${organizationId}/members/${actor.uid}`).get();
  const member = membership.exists ? organizationMemberSchema.parse(membership.data()) : null;
  if (!hasCapability(member, "projects.manage")) return [];
  const clients = await db.collection(`organizations/${organizationId}/clients`).where("status", "==", "active").get();
  return clients.docs.map((document) => clientSchema.parse({ id: document.id, ...document.data() }));
}
