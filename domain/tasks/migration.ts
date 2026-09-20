import "server-only";

import { createHash } from "node:crypto";
import { FieldValue, Timestamp, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { organizationSchema } from "@/domain/organizations/schemas";
import { getAccessibleProject } from "@/domain/projects/service";
import { dateInTimeZone } from "@/domain/tasks/my-work";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

const legacyTaskSchema = z.object({ title: z.string().trim().min(1).max(240), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), done: z.boolean(), deadline: z.string().nullable().optional(), notes: z.string().max(10000).nullable().optional(), tag: z.string().nullable().optional(), reminderTime: z.string().nullable().optional(), weeklyPriorityId: z.union([z.string(), z.number()]).nullable().optional(), linkRefs: z.string().nullable().optional(), fileRefs: z.string().nullable().optional() }).passthrough();
const legacySubtaskSchema = z.object({ taskId: z.string().min(1), title: z.string().trim().min(1).max(240), done: z.boolean() }).passthrough();
const unmappedKeys = ["tag", "reminderTime", "weeklyPriorityId", "linkRefs", "fileRefs"] as const;
const MAX_WRITES_PER_RUN = 350;

type SourceRecord = { id: string; data: unknown };
type MappedTask = { id: string; sourceId: string; sourceCollection: "daily_tasks" | "daily_subtasks"; sourcePath: string; title: string; description: string | null; status: "todo" | "done"; dueDate: string | null; dueAt: Date | null; dueTimeSet: boolean; parentTaskId: string | null; sortOrder: number };
export type MigrationPreview = { sourceTasks: number; sourceSubtasks: number; validTasks: number; validSubtasks: number; skipped: number; unmappedFields: Record<string, number>; issues: Array<{ collection: string; sourceId: string; reason: string }> };
export type MigrationResult = MigrationPreview & { created: number; alreadyMigrated: number; conflicts: number; remaining: number; status: "pending" | "completed" | "completed_with_issues" };
type Dependencies = { db?: Firestore; auditRepository?: AuditWriter };

function auditedMigrationFailure(actor: AuthActor, organizationId: string, projectId: string, correlation: AuditCorrelation, error: AuditedCommandError, dependencies: Dependencies): Promise<MigrationResult> {
  return executeAuditedCommand({ db: dependencies.db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "task.legacymigration.executed", target: { type: "migration", id: "legacy-user-v1" }, correlation, execute: async () => { throw error; } });
}

export function legacyDestinationId(userId: string, collection: "daily_tasks" | "daily_subtasks", sourceId: string) {
  return `legacy-${createHash("sha256").update(`${userId}:${collection}:${sourceId}`).digest("hex").slice(0, 32)}`;
}

function deadline(value: string | null | undefined, fallbackDate: string, timeZone: string) {
  if (!value) return { dueDate: fallbackDate, dueAt: null, dueTimeSet: false };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { dueDate: value, dueAt: null, dueTimeSet: false };
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return { dueDate: fallbackDate, dueAt: null, dueTimeSet: false };
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return { dueDate: fallbackDate, dueAt: null, dueTimeSet: false };
  return { dueDate: dateInTimeZone(instant, timeZone), dueAt: instant, dueTimeSet: true };
}

export function mapLegacyRecords(userId: string, tasks: SourceRecord[], subtasks: SourceRecord[], timeZone: string) {
  const mapped: MappedTask[] = []; const issues: MigrationPreview["issues"] = []; const unmappedFields: Record<string, number> = {};
  const parentIds = new Set<string>();
  tasks.forEach((source, index) => {
    const parsed = legacyTaskSchema.safeParse(source.data);
    if (!parsed.success) { issues.push({ collection: "daily_tasks", sourceId: source.id, reason: "Invalid task fields" }); return; }
    parentIds.add(source.id);
    for (const key of unmappedKeys) if (parsed.data[key] !== null && parsed.data[key] !== undefined && parsed.data[key] !== "") unmappedFields[key] = (unmappedFields[key] ?? 0) + 1;
    const due = deadline(parsed.data.deadline, parsed.data.date, timeZone);
    if (parsed.data.deadline && !parsed.data.deadline.match(/^\d{4}-\d{2}-\d{2}$/) && !/(Z|[+-]\d{2}:\d{2})$/.test(parsed.data.deadline)) unmappedFields.deadlineTime = (unmappedFields.deadlineTime ?? 0) + 1;
    mapped.push({ id: legacyDestinationId(userId, "daily_tasks", source.id), sourceId: source.id, sourceCollection: "daily_tasks", sourcePath: `users/${userId}/daily_tasks/${source.id}`, title: parsed.data.title, description: parsed.data.notes?.trim() || null, status: parsed.data.done ? "done" : "todo", ...due, parentTaskId: null, sortOrder: index });
  });
  subtasks.forEach((source, index) => {
    const parsed = legacySubtaskSchema.safeParse(source.data);
    if (!parsed.success) { issues.push({ collection: "daily_subtasks", sourceId: source.id, reason: "Invalid subtask fields" }); return; }
    if (!parentIds.has(parsed.data.taskId)) { issues.push({ collection: "daily_subtasks", sourceId: source.id, reason: "Parent task is unavailable" }); return; }
    mapped.push({ id: legacyDestinationId(userId, "daily_subtasks", source.id), sourceId: source.id, sourceCollection: "daily_subtasks", sourcePath: `users/${userId}/daily_subtasks/${source.id}`, title: parsed.data.title, description: null, status: parsed.data.done ? "done" : "todo", dueDate: null, dueAt: null, dueTimeSet: false, parentTaskId: legacyDestinationId(userId, "daily_tasks", parsed.data.taskId), sortOrder: tasks.length + index });
  });
  return { mapped, preview: { sourceTasks: tasks.length, sourceSubtasks: subtasks.length, validTasks: mapped.filter((item) => item.sourceCollection === "daily_tasks").length, validSubtasks: mapped.filter((item) => item.sourceCollection === "daily_subtasks").length, skipped: issues.length, unmappedFields, issues } satisfies MigrationPreview };
}

async function readSources(actor: AuthActor, timeZone: string, db: Firestore) {
  const [tasks, subtasks] = await Promise.all([db.collection(`users/${actor.uid}/daily_tasks`).get(), db.collection(`users/${actor.uid}/daily_subtasks`).get()]);
  return mapLegacyRecords(actor.uid, tasks.docs.map((doc) => ({ id: doc.id, data: doc.data() })), subtasks.docs.map((doc) => ({ id: doc.id, data: doc.data() })), timeZone);
}

export async function previewLegacyTaskMigration(actor: AuthActor, organizationId: string, db: Firestore = getAdminDb()): Promise<MigrationPreview> {
  const organization = await db.doc(`organizations/${organizationId}`).get();
  if (!organization.exists) throw new AuditedCommandError("failed", "organization_not_found", "Organization not found");
  return (await readSources(actor, organizationSchema.parse({ id: organization.id, ...organization.data() }).timezone, db)).preview;
}

export async function previewPendingLegacyTaskMigration(actor: AuthActor, organizationId: string, db: Firestore = getAdminDb()): Promise<MigrationPreview | null> {
  const marker = await db.doc(`organizations/${organizationId}/migrations/legacy-user-v1`).get();
  if (marker.exists && ["completed", "completed_with_issues"].includes(String(marker.data()?.status))) {
    return null;
  }
  return previewLegacyTaskMigration(actor, organizationId, db);
}

export async function migrateLegacyTasks(actor: AuthActor, organizationId: string, projectId: string, correlation: AuditCorrelation, dependencies: Dependencies = {}): Promise<MigrationResult> {
  const db = dependencies.db ?? getAdminDb();
  const markerRef = db.doc(`organizations/${organizationId}/migrations/legacy-user-v1`);
  const [access, organizationDoc, existingMarker] = await Promise.all([getAccessibleProject(actor, organizationId, projectId, db), db.doc(`organizations/${organizationId}`).get(), markerRef.get()]);
  if (!access || access.role === "client") return auditedMigrationFailure(actor, organizationId, projectId, correlation, new AuditedCommandError("denied", "legacy_migration_denied", "Migration access denied"), dependencies);
  if (access.project.status !== "active" || !access.project.enabledTools.includes("todos")) return auditedMigrationFailure(actor, organizationId, projectId, correlation, new AuditedCommandError("denied", "legacy_migration_target_invalid", "Choose an active project with To-dos enabled"), dependencies);
  if (!organizationDoc.exists) return auditedMigrationFailure(actor, organizationId, projectId, correlation, new AuditedCommandError("failed", "organization_not_found", "Organization not found"), dependencies);
  if (existingMarker.exists && existingMarker.data()?.targetProjectId && existingMarker.data()?.targetProjectId !== projectId) return auditedMigrationFailure(actor, organizationId, projectId, correlation, new AuditedCommandError("denied", "legacy_migration_target_locked", "Continue the migration in its original target project"), dependencies);
  const organization = organizationSchema.parse({ id: organizationDoc.id, ...organizationDoc.data() });
  const { mapped, preview } = await readSources(actor, organization.timezone, db);
  const refs = mapped.map((item) => db.doc(`organizations/${organizationId}/projects/${projectId}/tasks/${item.id}`));
  const snapshots: DocumentSnapshot[] = [];
  for (let index = 0; index < refs.length; index += 250) snapshots.push(...await db.getAll(...refs.slice(index, index + 250)));
  let alreadyMigrated = 0; let conflicts = 0;
  const missing = mapped.filter((item, index) => {
    const snapshot = snapshots[index]; if (!snapshot?.exists) return true;
    const source = snapshot.data()?.migrationSource;
    if (source?.kind === "legacy-user-v1" && source.sourceId === item.sourceId && source.sourceCollection === item.sourceCollection) { alreadyMigrated++; return false; }
    conflicts++; return false;
  });
  const candidates = missing.slice(0, MAX_WRITES_PER_RUN);
  const remainingBeforeRun = Math.max(0, missing.length - candidates.length);
  return executeAuditedCommand<MigrationResult>({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: access.role }, action: "task.legacymigration.executed", target: { type: "migration", id: "legacy-user-v1" }, correlation, changes: (result) => [{ field: "status", to: result.status }], execute: async (transaction) => {
    const candidateRefs = candidates.map((item) => db.doc(`organizations/${organizationId}/projects/${projectId}/tasks/${item.id}`));
    const [markerSnapshot, ...current] = await Promise.all([transaction.get(markerRef), ...candidateRefs.map((ref) => transaction.get(ref))]);
    let created = 0; let racedExisting = 0; let racedConflicts = 0;
    candidates.forEach((item, index) => {
      const snapshot = current[index];
      if (snapshot.exists) { const source = snapshot.data()?.migrationSource; if (source?.kind === "legacy-user-v1" && source.sourceId === item.sourceId && source.sourceCollection === item.sourceCollection) racedExisting++; else racedConflicts++; return; }
      const now = FieldValue.serverTimestamp();
      transaction.create(candidateRefs[index], { projectId, title: item.title, description: item.description, assigneeIds: [actor.uid], status: item.status, priority: "medium", dueDate: item.dueDate, dueAt: item.dueAt ? Timestamp.fromDate(item.dueAt) : null, dueTimeSet: item.dueTimeSet, visibility: "internal", parentTaskId: item.parentTaskId, boardColumnId: null, sortOrder: item.sortOrder, completedAt: item.status === "done" ? now : null, archivedAt: null, migrationSource: { kind: "legacy-user-v1", sourceCollection: item.sourceCollection, sourceId: item.sourceId, sourcePath: item.sourcePath, version: 1, migratedAt: now }, createdBy: actor.uid, createdAt: now, updatedBy: actor.uid, updatedAt: now }); created++;
    });
    const totalAlready = alreadyMigrated + racedExisting; const totalConflicts = conflicts + racedConflicts; const remaining = remainingBeforeRun;
    const status = remaining > 0 ? "pending" : preview.skipped + totalConflicts > 0 ? "completed_with_issues" : "completed";
    const result: MigrationResult = { ...preview, created, alreadyMigrated: totalAlready, conflicts: totalConflicts, remaining, status };
    const marker = { organizationId, sourceUserId: actor.uid, sourcePath: `users/${actor.uid}`, status, schemaVersion: 1, targetProjectId: projectId, summary: { sourceTasks: preview.sourceTasks, sourceSubtasks: preview.sourceSubtasks, created, alreadyMigrated: totalAlready, skipped: preview.skipped, conflicts: totalConflicts, remaining }, lastRunAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), ...(markerSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) };
    transaction.set(markerRef, marker, { merge: true }); return result;
  }});
}
