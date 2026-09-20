import "server-only";

import { FieldValue, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { canAccessProject, hasCapability } from "@/domain/organizations/policy";
import { organizationMemberSchema, projectAssignmentSchema, projectSchema } from "@/domain/organizations/schemas";
import { projectTaskSchema } from "@/domain/tasks/schemas";
import { activeTimerPointerSchema, activeTimerSchema, correctTimeEntryCommandSchema, createManualEntryCommandSchema, startTimerCommandSchema, stopTimerCommandSchema, timeEntrySchema, type ActiveTimer, type TimeEntry } from "@/domain/time/schemas";
import { TimeRepository } from "@/domain/time/repository";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

type Dependencies = {
  db?: Firestore;
  auditRepository?: AuditWriter;
  now?: () => Timestamp;
};

export async function startTimer(
  actor: AuthActor,
  organizationId: string,
  projectId: string,
  raw: unknown,
  correlation: AuditCorrelation,
  dependencies: Dependencies = {},
): Promise<ActiveTimer> {
  const command = startTimerCommandSchema.parse(raw);
  const db = dependencies.db ?? getAdminDb();
  const repository = new TimeRepository(db);
  const pointerReference = repository.activeTimerPointerReference(actor.uid);
  const timerReference = repository.activeTimerReference(organizationId, projectId, actor.uid);
  const startedAt = (dependencies.now ?? Timestamp.now)();

  return executeAuditedCommand<ActiveTimer>({
    db,
    auditRepository: dependencies.auditRepository,
    organizationId,
    projectId,
    actor: { type: "user", id: actor.uid, role: null },
    action: "time.timer.started",
    target: { type: "timer", id: actor.uid },
    correlation,
    execute: async (transaction) => {
      const memberReference = db.doc(`organizations/${organizationId}/members/${actor.uid}`);
      const assignmentReference = db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${actor.uid}`);
      const projectReference = db.doc(`organizations/${organizationId}/projects/${projectId}`);
      const taskReference = command.taskId
        ? db.doc(`organizations/${organizationId}/projects/${projectId}/tasks/${command.taskId}`)
        : null;
      const [pointerSnapshot, memberSnapshot, assignmentSnapshot, projectSnapshot, taskSnapshot] = await Promise.all([
        transaction.get(pointerReference),
        transaction.get(memberReference),
        transaction.get(assignmentReference),
        transaction.get(projectReference),
        taskReference ? transaction.get(taskReference) : Promise.resolve(null),
      ]);

      const member = memberSnapshot.exists ? organizationMemberSchema.parse(memberSnapshot.data()) : null;
      const assignment = assignmentSnapshot.exists ? projectAssignmentSchema.parse(assignmentSnapshot.data()) : null;
      if (!hasCapability(member, "time.track") || !canAccessProject(member, assignment)) {
        throw new AuditedCommandError("denied", "timer_start_denied", "Time tracking denied");
      }
      if (pointerSnapshot.exists) {
        throw new AuditedCommandError("denied", "timer_already_active", "A timer is already active");
      }
      if (!projectSnapshot.exists) {
        throw new AuditedCommandError("failed", "project_not_found", "Project not found");
      }
      const project = projectSchema.parse({ id: projectSnapshot.id, ...projectSnapshot.data() });
      if (project.status !== "active" || !project.enabledTools.includes("time")) {
        throw new AuditedCommandError("denied", "project_time_unavailable", "Project time tracking is unavailable");
      }
      if (member!.role !== "admin" && !command.taskId) {
        throw new AuditedCommandError("denied", "timer_task_required", "A saved task is required");
      }
      if (command.taskId) {
        if (!taskSnapshot?.exists) throw new AuditedCommandError("failed", "timer_task_not_found", "Task not found");
        const task = projectTaskSchema.parse({ id: taskSnapshot.id, ...taskSnapshot.data() });
        if (task.projectId !== projectId || task.archivedAt) {
          throw new AuditedCommandError("denied", "timer_task_unavailable", "Task is unavailable");
        }
      }

      const timer = activeTimerSchema.parse({
        userId: actor.uid,
        organizationId,
        projectId,
        taskId: command.taskId,
        startedAt,
        note: command.note,
      });
      transaction.create(timerReference, timer);
      transaction.create(pointerReference, { organizationId, projectId, userId: actor.uid, startedAt });
      return timer;
    },
  });
}

export async function getActiveTimer(actor: AuthActor, db: Firestore = getAdminDb()) {
  return new TimeRepository(db).getActiveTimer(actor.uid);
}

export function elapsedTimerSeconds(startedAt: { seconds: number; nanoseconds: number }, now: Date = new Date()): number {
  const startedAtMilliseconds = startedAt.seconds * 1000 + startedAt.nanoseconds / 1_000_000;
  return Math.max(0, Math.floor((now.getTime() - startedAtMilliseconds) / 1000));
}

const MAX_ENTRY_SECONDS = 31_622_400;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function durationSeconds(startedAt: Timestamp, endedAt: Timestamp, now: Timestamp) {
  const duration = Math.floor((endedAt.toMillis() - startedAt.toMillis()) / 1000);
  if (duration < 1) throw new AuditedCommandError("failed", "time_range_invalid", "End time must be after start time");
  if (duration > MAX_ENTRY_SECONDS) throw new AuditedCommandError("failed", "time_duration_unreasonable", "Time duration is unreasonable");
  if (endedAt.toMillis() > now.toMillis() + FUTURE_TOLERANCE_MS) throw new AuditedCommandError("failed", "time_end_in_future", "End time cannot be in the future");
  return duration;
}

async function requireTimeWriter(transaction: Transaction, db: Firestore, organizationId: string, projectId: string, uid: string, taskId: string | null) {
  const refs = [
    db.doc(`organizations/${organizationId}/members/${uid}`),
    db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${uid}`),
    db.doc(`organizations/${organizationId}/projects/${projectId}`),
  ];
  const [memberDoc, assignmentDoc, projectDoc] = await Promise.all(refs.map((reference) => transaction.get(reference)));
  const member = memberDoc.exists ? organizationMemberSchema.parse(memberDoc.data()) : null;
  const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
  if (!hasCapability(member, "time.track") || !canAccessProject(member, assignment)) throw new AuditedCommandError("denied", "time_entry_denied", "Time entry denied");
  if (!projectDoc.exists) throw new AuditedCommandError("failed", "project_not_found", "Project not found");
  const project = projectSchema.parse({ id: projectDoc.id, ...projectDoc.data() });
  if (project.status !== "active" || !project.enabledTools.includes("time")) throw new AuditedCommandError("denied", "project_time_unavailable", "Project time tracking is unavailable");
  if (member!.role !== "admin" && !taskId) throw new AuditedCommandError("denied", "timer_task_required", "A saved task is required");
  if (taskId) {
    const taskDoc = await transaction.get(db.doc(`organizations/${organizationId}/projects/${projectId}/tasks/${taskId}`));
    if (!taskDoc.exists) throw new AuditedCommandError("failed", "timer_task_not_found", "Task not found");
    const task = projectTaskSchema.parse({ id: taskDoc.id, ...taskDoc.data() });
    if (task.archivedAt) throw new AuditedCommandError("denied", "timer_task_unavailable", "Task is unavailable");
  }
  return member!;
}

export async function stopTimer(actor: AuthActor, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}): Promise<TimeEntry> {
  const command = stopTimerCommandSchema.parse(raw);
  const db = dependencies.db ?? getAdminDb();
  const repository = new TimeRepository(db);
  const pointer = await repository.getActiveTimerPointer(actor.uid);
  if (!pointer) throw new AuditedCommandError("failed", "timer_not_active", "No timer is active");
  const timerRef = repository.activeTimerReference(pointer.organizationId, pointer.projectId, actor.uid);
  const pointerRef = repository.activeTimerPointerReference(actor.uid);
  const entryRef = repository.timeEntriesCollection(pointer.organizationId, pointer.projectId).doc();
  const endedAt = (dependencies.now ?? Timestamp.now)();
  return executeAuditedCommand<TimeEntry>({
    db, auditRepository: dependencies.auditRepository, organizationId: pointer.organizationId, projectId: pointer.projectId,
    actor: { type: "user", id: actor.uid, role: null }, action: "time.timer.stopped", target: { type: "timer", id: actor.uid }, correlation,
    additionalSuccessAudits: (entry) => [{ action: "time.entry.created", target: { type: "time-entry", id: entry.id }, changes: [{ field: "billable", to: entry.billable }, { field: "clientReportingStatus", to: entry.clientReportingStatus }] }],
    execute: async (transaction) => {
      const [currentPointer, timerDoc] = await Promise.all([transaction.get(pointerRef), transaction.get(timerRef)]);
      if (!currentPointer.exists || !timerDoc.exists) throw new AuditedCommandError("failed", "timer_not_active", "No timer is active");
      const parsedPointer = activeTimerPointerSchema.parse(currentPointer.data());
      const timer = activeTimerSchema.parse(timerDoc.data());
      if (parsedPointer.organizationId !== pointer.organizationId || parsedPointer.projectId !== pointer.projectId || timer.userId !== actor.uid) throw new AuditedCommandError("failed", "timer_state_conflict", "Timer state changed");
      const duration = durationSeconds(Timestamp.fromMillis(timer.startedAt.seconds * 1000 + timer.startedAt.nanoseconds / 1_000_000), endedAt, endedAt);
      const now = FieldValue.serverTimestamp();
      const entry = timeEntrySchema.parse({ id: entryRef.id, organizationId: timer.organizationId, projectId: timer.projectId, taskId: timer.taskId, userId: actor.uid, source: "timer", startedAt: timer.startedAt, endedAt, durationSeconds: duration, note: command.note, billable: command.billable, clientReportingStatus: command.clientReportingStatus, correctionCount: 0, createdBy: actor.uid, createdAt: endedAt, updatedBy: actor.uid, updatedAt: endedAt });
      const { id: _entryId, ...storedEntry } = entry; void _entryId;
      transaction.create(entryRef, { ...storedEntry, createdAt: now, updatedAt: now });
      transaction.delete(timerRef); transaction.delete(pointerRef);
      return entry;
    },
  });
}

export async function createManualTimeEntry(actor: AuthActor, organizationId: string, projectId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}): Promise<TimeEntry> {
  const command = createManualEntryCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const repository = new TimeRepository(db); const entryRef = repository.timeEntriesCollection(organizationId, projectId).doc();
  const startedAt = Timestamp.fromDate(new Date(command.startedAt)); const endedAt = Timestamp.fromDate(new Date(command.endedAt)); const now = (dependencies.now ?? Timestamp.now)();
  return executeAuditedCommand<TimeEntry>({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "time.entry.created", target: { type: "time-entry", id: entryRef.id }, correlation, changes: [{ field: "billable", to: command.billable }, { field: "clientReportingStatus", to: command.clientReportingStatus }], execute: async (transaction) => {
    await requireTimeWriter(transaction, db, organizationId, projectId, actor.uid, command.taskId); const duration = durationSeconds(startedAt, endedAt, now); const serverNow = FieldValue.serverTimestamp();
    const entry = timeEntrySchema.parse({ id: entryRef.id, organizationId, projectId, taskId: command.taskId, userId: actor.uid, source: "manual", startedAt, endedAt, durationSeconds: duration, note: command.note, billable: command.billable, clientReportingStatus: command.clientReportingStatus, correctionCount: 0, createdBy: actor.uid, createdAt: now, updatedBy: actor.uid, updatedAt: now });
    const { id: _entryId, ...storedEntry } = entry; void _entryId; transaction.create(entryRef, { ...storedEntry, createdAt: serverNow, updatedAt: serverNow }); return entry;
  }});
}

export async function correctTimeEntry(actor: AuthActor, organizationId: string, projectId: string, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}): Promise<TimeEntry> {
  const command = correctTimeEntryCommandSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const repository = new TimeRepository(db); const entryRef = repository.timeEntryReference(organizationId, projectId, command.entryId);
  const startedAt = Timestamp.fromDate(new Date(command.startedAt)); const endedAt = Timestamp.fromDate(new Date(command.endedAt)); const now = (dependencies.now ?? Timestamp.now)();
  return executeAuditedCommand<TimeEntry>({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "time.entry.corrected", target: { type: "time-entry", id: command.entryId }, correlation, changes: [{ field: "billable", to: command.billable }, { field: "clientReportingStatus", to: command.clientReportingStatus }], execute: async (transaction) => {
    const member = await requireTimeWriter(transaction, db, organizationId, projectId, actor.uid, command.taskId); const duration = durationSeconds(startedAt, endedAt, now); const snapshot = await transaction.get(entryRef); if (!snapshot.exists) throw new AuditedCommandError("failed", "time_entry_not_found", "Time entry not found"); const existing = timeEntrySchema.parse({ id: snapshot.id, ...snapshot.data() });
    if (member.role !== "admin" && existing.userId !== actor.uid) throw new AuditedCommandError("denied", "time_entry_correction_denied", "Time entry correction denied");
    const updated = timeEntrySchema.parse({ ...existing, taskId: command.taskId, startedAt, endedAt, durationSeconds: duration, note: command.note, billable: command.billable, clientReportingStatus: command.clientReportingStatus, correctionCount: existing.correctionCount + 1, updatedBy: actor.uid, updatedAt: now });
    transaction.update(entryRef, { taskId: updated.taskId, startedAt, endedAt, durationSeconds: duration, note: updated.note, billable: updated.billable, clientReportingStatus: updated.clientReportingStatus, correctionCount: updated.correctionCount, updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }); return updated;
  }});
}
