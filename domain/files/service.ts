import "server-only";

import { FieldValue, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { canAccessProject } from "@/domain/organizations/policy";
import { organizationMemberSchema, projectAssignmentSchema, projectSchema } from "@/domain/organizations/schemas";
import { canChangeVisibility, canReadVisibleRecord } from "@/domain/visibility/policy";
import { visibilitySchema } from "@/domain/visibility/schemas";
import { createFileIntentSchema, fileRecordSchema, hasSupportedFileSignature, safeStoredFilename, type FileListItem } from "@/domain/files/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase-admin";
import { isProjectToolAvailable } from "@/domain/projects/tools";

type Dependencies = { db?: Firestore; auditRepository?: AuditWriter };
const collectionPath = (org: string, project: string) => `organizations/${org}/projects/${project}/files`;

async function access(transaction: Transaction, db: Firestore, org: string, project: string, uid: string) {
  const [memberDoc, assignmentDoc, projectDoc] = await Promise.all([
    transaction.get(db.doc(`organizations/${org}/members/${uid}`)),
    transaction.get(db.doc(`organizations/${org}/projects/${project}/projectMembers/${uid}`)),
    transaction.get(db.doc(`organizations/${org}/projects/${project}`)),
  ]);
  const member = memberDoc.exists ? organizationMemberSchema.parse(memberDoc.data()) : null;
  const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
  const projectRecord = projectDoc.exists ? projectSchema.parse({ id: projectDoc.id, ...projectDoc.data() }) : null;
  if (!projectRecord || !canAccessProject(member, assignment)) throw new AuditedCommandError("denied", "file_access_denied", "File access denied");
  return { member, assignment, project: projectRecord };
}

export async function createFileUploadIntent(actor: AuthActor, organizationId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  if (!isProjectToolAvailable("docs")) throw new AuditedCommandError("denied", "file_storage_disabled", "File storage is temporarily unavailable");
  const command = createFileIntentSchema.parse(raw); const db = dependencies.db ?? getAdminDb();
  const reference = db.collection(collectionPath(organizationId, command.projectId)).doc();
  const safeName = safeStoredFilename(command.originalName);
  const storagePath = `${collectionPath(organizationId, command.projectId)}/${reference.id}/${safeName}`;
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId: command.projectId,
    actor: { type: "user", id: actor.uid, role: null }, action: "file.record.uploaded", target: { type: "file", id: reference.id }, correlation,
    changes: [{ field: "status", to: "pending" }, { field: "visibility", to: "internal" }],
    execute: async (transaction) => {
      const current = await access(transaction, db, organizationId, command.projectId, actor.uid);
      if (current.member?.role === "client") throw new AuditedCommandError("denied", "file_upload_denied", "Clients cannot upload files");
      if (current.project.status !== "active" || !current.project.enabledTools.includes("docs")) throw new AuditedCommandError("denied", "file_upload_unavailable", "File uploads are unavailable");
      const now = FieldValue.serverTimestamp();
      transaction.create(reference, { organizationId, projectId: command.projectId, originalName: command.originalName, safeName, storagePath,
        contentType: command.contentType, sizeBytes: command.sizeBytes, checksum: null, uploaderId: actor.uid, visibility: "internal",
        status: "pending", scanStatus: "unscanned", createdAt: now, updatedAt: now, uploadExpiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000), finalizedAt: null, archivedAt: null });
      return { fileId: reference.id, storagePath, metadata: { organizationId, projectId: command.projectId, fileId: reference.id, uploaderId: actor.uid } };
    },
  });
}

export async function finalizeFileUpload(actor: AuthActor, organizationId: string, projectId: string, fileId: string, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  if (!isProjectToolAvailable("docs")) throw new AuditedCommandError("denied", "file_storage_disabled", "File storage is temporarily unavailable");
  const db = dependencies.db ?? getAdminDb(); const reference = db.doc(`${collectionPath(organizationId, projectId)}/${fileId}`);
  const before = await reference.get();
  if (!before.exists) throw new Error("File not found");
  const pending = fileRecordSchema.parse({ id: before.id, ...before.data() });
  const object = getAdminStorageBucket().file(pending.storagePath);
  const [[metadata], [prefix]] = await Promise.all([object.getMetadata(), object.download({ start: 0, end: Math.min(pending.sizeBytes - 1, 4095) })]);
  const observedSize = Number(metadata.size ?? 0); const observedType = metadata.contentType ?? "";
  const valid = observedSize === pending.sizeBytes && observedType === pending.contentType && hasSupportedFileSignature(observedType, prefix);
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId,
    actor: { type: "user", id: actor.uid, role: null }, action: "file.record.uploaded", target: { type: "file", id: fileId }, correlation,
    changes: [{ field: "status", to: valid ? "ready" : "failed" }],
    execute: async (transaction) => {
      const current = await access(transaction, db, organizationId, projectId, actor.uid);
      if (current.member?.role === "client" || pending.uploaderId !== actor.uid || pending.status !== "pending") throw new AuditedCommandError("denied", "file_finalize_denied", "File finalization denied");
      transaction.update(reference, { contentType: observedType, sizeBytes: observedSize,
        checksum: metadata.md5Hash ? { algorithm: "md5", value: metadata.md5Hash } : metadata.crc32c ? { algorithm: "crc32c", value: metadata.crc32c } : null,
        status: valid ? "ready" : "failed", uploadExpiresAt: null, finalizedAt: valid ? FieldValue.serverTimestamp() : null, updatedAt: FieldValue.serverTimestamp() });
      if (!valid) throw new AuditedCommandError("failed", "file_metadata_mismatch", "Uploaded file validation failed");
    },
  });
}

export async function listProjectFiles(actor: AuthActor, organizationId: string, projectId: string, db: Firestore = getAdminDb()): Promise<{ files: FileListItem[]; canUpload: boolean; role: string }> {
  const [memberDoc, assignmentDoc] = await Promise.all([db.doc(`organizations/${organizationId}/members/${actor.uid}`).get(), db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${actor.uid}`).get()]);
  const member = memberDoc.exists ? organizationMemberSchema.parse(memberDoc.data()) : null;
  const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
  if (!canAccessProject(member, assignment)) return { files: [], canUpload: false, role: member?.role ?? "none" };
  const snapshot = await db.collection(collectionPath(organizationId, projectId)).where("status", "==", "ready").orderBy("createdAt", "desc").limit(100).get();
  const files = snapshot.docs.map((doc) => fileRecordSchema.parse({ id: doc.id, ...doc.data() })).filter((file) => canReadVisibleRecord(member, assignment, file.visibility) && (member?.role !== "client" || file.scanStatus === "clean"));
  const iso = (value: { seconds: number }) => new Date(value.seconds * 1000).toISOString();
  return { files: files.map((file) => ({ ...file, createdAt: iso(file.createdAt), updatedAt: iso(file.updatedAt), uploadExpiresAt: file.uploadExpiresAt ? iso(file.uploadExpiresAt) : null, finalizedAt: file.finalizedAt ? iso(file.finalizedAt) : null, archivedAt: file.archivedAt ? iso(file.archivedAt) : null })), canUpload: member?.role !== "client", role: member?.role ?? "none" };
}

export async function changeFileVisibility(actor: AuthActor, organizationId: string, projectId: string, fileId: string, rawVisibility: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  if (!isProjectToolAvailable("docs")) throw new AuditedCommandError("denied", "file_storage_disabled", "File storage is temporarily unavailable");
  const visibility = visibilitySchema.parse(rawVisibility); const db = dependencies.db ?? getAdminDb(); const reference = db.doc(`${collectionPath(organizationId, projectId)}/${fileId}`);
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "visibility.record.changed", target: { type: "file", id: fileId }, correlation, changes: [{ field: "visibility", to: visibility }], execute: async (transaction) => {
    const current = await access(transaction, db, organizationId, projectId, actor.uid); const snapshot = await transaction.get(reference); const file = snapshot.exists ? fileRecordSchema.parse({ id: snapshot.id, ...snapshot.data() }) : null;
    if (!file || !canChangeVisibility(current.member, current.assignment)) throw new AuditedCommandError("denied", "file_visibility_denied", "File visibility change denied");
    if (visibility === "client-visible" && file.scanStatus !== "clean") throw new AuditedCommandError("denied", "file_scan_required", "A clean malware scan is required before client sharing");
    transaction.update(reference, { visibility, updatedAt: FieldValue.serverTimestamp() });
  }});
}

export async function archiveFile(actor: AuthActor, organizationId: string, projectId: string, fileId: string, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  if (!isProjectToolAvailable("docs")) throw new AuditedCommandError("denied", "file_storage_disabled", "File storage is temporarily unavailable");
  const db = dependencies.db ?? getAdminDb(); const reference = db.doc(`${collectionPath(organizationId, projectId)}/${fileId}`);
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "file.record.deleted", target: { type: "file", id: fileId }, correlation, changes: [{ field: "status", to: "archived" }], execute: async (transaction) => {
    const current = await access(transaction, db, organizationId, projectId, actor.uid); const snapshot = await transaction.get(reference);
    if (!snapshot.exists || current.member?.role === "client") throw new AuditedCommandError("denied", "file_archive_denied", "File archive denied");
    transaction.update(reference, { status: "archived", archivedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }});
}

export async function authorizeFileDownload(actor: AuthActor, organizationId: string, projectId: string, fileId: string, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  if (!isProjectToolAvailable("docs")) throw new AuditedCommandError("denied", "file_storage_disabled", "File storage is temporarily unavailable");
  const db = dependencies.db ?? getAdminDb(); const reference = db.doc(`${collectionPath(organizationId, projectId)}/${fileId}`);
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "file.record.downloaded", target: { type: "file", id: fileId }, correlation, execute: async (transaction) => {
    const current = await access(transaction, db, organizationId, projectId, actor.uid); const snapshot = await transaction.get(reference); const file = snapshot.exists ? fileRecordSchema.parse({ id: snapshot.id, ...snapshot.data() }) : null;
    if (!file || file.status !== "ready" || !canReadVisibleRecord(current.member, current.assignment, file.visibility) || (current.member?.role === "client" && file.scanStatus !== "clean")) throw new AuditedCommandError("denied", "file_download_denied", "File download denied");
    return file;
  }});
}
