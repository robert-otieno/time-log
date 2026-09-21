import "server-only";

import { cache } from "react";
import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { canManageProject, hasCapability } from "@/domain/organizations/policy";
import { clientSchema, organizationMemberSchema, projectAssignmentSchema, projectSchema, type Project } from "@/domain/organizations/schemas";
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

async function requireProjectManager(transaction: FirebaseFirestore.Transaction, db: Firestore, organizationId: string, projectId: string, uid: string) {
  const [memberSnapshot, assignmentSnapshot] = await Promise.all([
    transaction.get(db.doc(`organizations/${organizationId}/members/${uid}`)),
    transaction.get(db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${uid}`)),
  ]);
  const member = memberSnapshot.exists ? organizationMemberSchema.parse(memberSnapshot.data()) : null;
  const assignment = assignmentSnapshot.exists ? projectAssignmentSchema.parse(assignmentSnapshot.data()) : null;
  if (!canManageProject(member, assignment)) throw new AuditedCommandError("denied", "projects_manage_denied", "Project management denied");
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
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId: command.projectId, actor: { type: "user", id: actor.uid, role: null }, action: "project.record.updated", target: { type: "project", id: command.projectId }, correlation, changes: [{ field: "enabled", to: true }], execute: async (transaction) => {
    const manager = await requireProjectManager(transaction, db, organizationId, command.projectId, actor.uid); const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new AuditedCommandError("failed", "project_not_found", "Project not found");
    const existing = projectSchema.parse({ id: snapshot.id, ...snapshot.data() });
    if (existing.status !== "active") throw new AuditedCommandError("denied", "project_read_only", "Restore the project before editing");
    if (manager.role !== "admin" && command.clientId !== existing.clientId) throw new AuditedCommandError("denied", "project_client_manage_denied", "Only organization administrators can change a project's client");
    if (command.clientId) {
      const client = await transaction.get(db.doc(`organizations/${organizationId}/clients/${command.clientId}`));
      if (!client.exists || clientSchema.parse({ id: client.id, ...client.data() }).status !== "active") throw new AuditedCommandError("failed", "client_not_found", "Client not found");
    }
    transaction.update(reference, { name: command.name, description: command.description, clientId: command.clientId, enabledTools: command.enabledTools, updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() });
  }});
}

export async function changeProjectStatus(actor: AuthActor, organizationId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = changeProjectStatusCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const reference = db.doc(`organizations/${organizationId}/projects/${command.projectId}`);
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId: command.projectId, actor: { type: "user", id: actor.uid, role: null }, action: command.status === "archived" ? "project.record.archived" : "project.record.updated", target: { type: "project", id: command.projectId }, correlation, changes: [{ field: "projectStatus", to: command.status }], execute: async (transaction) => { await requireProjectManager(transaction, db, organizationId, command.projectId, actor.uid); const snapshot = await transaction.get(reference); if (!snapshot.exists) throw new AuditedCommandError("failed", "project_not_found", "Project not found"); transaction.update(reference, { status: command.status, updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }); }});
}

async function listAccessibleProjectsFromDb(actor: Pick<AuthActor, "uid">, organizationId: string, db: Firestore) {
  const membershipSnapshot = await db.doc(`organizations/${organizationId}/members/${actor.uid}`).get();
  const member = membershipSnapshot.exists ? organizationMemberSchema.parse(membershipSnapshot.data()) : null;
  if (!member || member.status !== "active") return null;
  if (member.role !== "admin") {
    const assignments = await db.collectionGroup("projectMembers")
      .where("userId", "==", actor.uid)
      .where("status", "==", "active")
      .get();
    const projectReferences = assignments.docs
      .map((assignment) => assignment.ref.parent.parent)
      .filter((reference): reference is DocumentReference => reference !== null && reference.parent.parent?.id === organizationId);
    if (projectReferences.length === 0) return [];
    const projects = await db.getAll(...projectReferences);
    return projects
      .filter((project) => project.exists)
      .map((project) => projectSchema.parse({ id: project.id, ...project.data() }));
  }
  const projects = await db.collection(`organizations/${organizationId}/projects`).get();
  return projects.docs.map((document) => projectSchema.parse({ id: document.id, ...document.data() }));
}

const listAccessibleProjectsCached = cache(async (uid: string, organizationId: string) =>
  listAccessibleProjectsFromDb({ uid }, organizationId, getAdminDb()),
);

export async function listAccessibleProjects(actor: AuthActor, organizationId: string, db?: Firestore) {
  return db
    ? listAccessibleProjectsFromDb(actor, organizationId, db)
    : listAccessibleProjectsCached(actor.uid, organizationId);
}

async function getAccessibleProjectFromDb(actor: Pick<AuthActor, "uid">, organizationId: string, projectId: string, db: Firestore) {
  const [membershipSnapshot, projectSnapshot, assignmentSnapshot] = await Promise.all([
    db.doc(`organizations/${organizationId}/members/${actor.uid}`).get(),
    db.doc(`organizations/${organizationId}/projects/${projectId}`).get(),
    db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${actor.uid}`).get(),
  ]);
  const member = membershipSnapshot.exists ? organizationMemberSchema.parse(membershipSnapshot.data()) : null;
  if (!member || member.status !== "active" || !projectSnapshot.exists) return null;
  const assignment = assignmentSnapshot.exists ? projectAssignmentSchema.parse(assignmentSnapshot.data()) : null;
  if (member.role !== "admin" && assignment?.status !== "active") return null;
  return { project: projectSchema.parse({ id: projectSnapshot.id, ...projectSnapshot.data() }), role: member.role, canManageProject: canManageProject(member, assignment) };
}

const getAccessibleProjectCached = cache(async (uid: string, organizationId: string, projectId: string) =>
  getAccessibleProjectFromDb({ uid }, organizationId, projectId, getAdminDb()),
);

export async function getAccessibleProject(actor: AuthActor, organizationId: string, projectId: string, db?: Firestore) {
  return db
    ? getAccessibleProjectFromDb(actor, organizationId, projectId, db)
    : getAccessibleProjectCached(actor.uid, organizationId, projectId);
}

export async function selectActiveProject(actor: AuthActor, organizationId: string, raw: unknown, dependencies: Dependencies = {}) {
  const command = selectProjectCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb();
  const projects = await listAccessibleProjects(actor, organizationId, db);
  if (!projects?.some((project) => project.id === command.projectId && project.status !== "archived")) throw new AuditedCommandError("denied", "project_access_denied", "Project access denied");
  await db.doc(`users/${actor.uid}/preferences/workspace`).set({ activeOrganizationId: organizationId, activeProjectId: command.projectId, source: "user", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function listActiveProjectClients(actor: AuthActor, organizationId: string, projectId?: string, db: Firestore = getAdminDb()) {
  const [membership, assignmentSnapshot, projectSnapshot] = await Promise.all([
    db.doc(`organizations/${organizationId}/members/${actor.uid}`).get(),
    projectId
      ? db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${actor.uid}`).get()
      : Promise.resolve(null),
    projectId
      ? db.doc(`organizations/${organizationId}/projects/${projectId}`).get()
      : Promise.resolve(null),
  ]);
  const member = membership.exists ? organizationMemberSchema.parse(membership.data()) : null;
  const assignment = assignmentSnapshot?.exists ? projectAssignmentSchema.parse(assignmentSnapshot.data()) : null;
  if (projectId ? !canManageProject(member, assignment) : !hasCapability(member, "projects.manage")) return [];
  if (projectId && member?.role !== "admin") {
    const project = projectSnapshot?.exists ? projectSchema.parse({ id: projectSnapshot.id, ...projectSnapshot.data() }) : null;
    if (!project?.clientId) return [];
    const client = await db.doc(`organizations/${organizationId}/clients/${project.clientId}`).get();
    return client.exists && clientSchema.parse({ id: client.id, ...client.data() }).status === "active"
      ? [clientSchema.parse({ id: client.id, ...client.data() })]
      : [];
  }
  const clients = await db.collection(`organizations/${organizationId}/clients`).where("status", "==", "active").get();
  return clients.docs.map((document) => clientSchema.parse({ id: document.id, ...document.data() }));
}
