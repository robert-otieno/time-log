import "server-only";

import { FieldValue, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { canAccessProject, hasCapability } from "@/domain/organizations/policy";
import { organizationMemberSchema, projectAssignmentSchema, projectSchema } from "@/domain/organizations/schemas";
import { projectTaskSchema } from "@/domain/tasks/schemas";
import { activeTimerPointerSchema, activeTimerSchema, configureTimerAlarmCommandSchema, correctTimeEntryCommandSchema, createManualEntryCommandSchema, snoozeTimerAlarmCommandSchema, startTimerCommandSchema, stopTimerCommandSchema, timeEntrySchema, type ActiveTimer, type TimeEntry } from "@/domain/time/schemas";
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
        if (task.projectId !== projectId || task.archivedAt || task.status === "done") {
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
        state: "running",
        accumulatedSeconds: 0,
        currentSegmentStartedAt: startedAt,
        segments: [],
        pausedAt: null,
        pauseReason: null,
        alarm: command.alarmDurationSeconds ? { durationSeconds: command.alarmDurationSeconds, dueAtTrackedSeconds: command.alarmDurationSeconds, status: "armed", triggeredAt: null, acknowledgedAt: null, snoozeCount: 0 } : null,
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

function timestampFromValue(value: { seconds: number; nanoseconds: number }) {
  return new Timestamp(value.seconds, value.nanoseconds);
}

function segmentSeconds(startedAt: { seconds: number; nanoseconds: number }, endedAt: Timestamp) {
  return Math.max(0, Math.floor((endedAt.toMillis() - timestampFromValue(startedAt).toMillis()) / 1000));
}

export function trackedTimerSeconds(timer: ActiveTimer, now: Date = new Date()): number {
  if (timer.state === "paused" || !timer.currentSegmentStartedAt) return timer.accumulatedSeconds;
  return timer.accumulatedSeconds + elapsedTimerSeconds(timer.currentSegmentStartedAt, now);
}

async function transitionTimer(
  actor: AuthActor,
  nextState: "running" | "paused",
  reason: "manual" | "inactivity" | null,
  correlation: AuditCorrelation,
  dependencies: Dependencies = {},
  effectiveAt?: Timestamp,
): Promise<ActiveTimer> {
  const db = dependencies.db ?? getAdminDb();
  const repository = new TimeRepository(db);
  const pointer = await repository.getActiveTimerPointer(actor.uid);
  if (!pointer) throw new AuditedCommandError("failed", "timer_not_active", "No timer is active");
  const timerRef = repository.activeTimerReference(pointer.organizationId, pointer.projectId, actor.uid);
  const pointerRef = repository.activeTimerPointerReference(actor.uid);
  const serverNow = (dependencies.now ?? Timestamp.now)();
  const changedAt = effectiveAt ?? serverNow;
  const action = nextState === "paused" ? "time.timer.paused" : "time.timer.resumed";

  return executeAuditedCommand<ActiveTimer>({
    db,
    auditRepository: dependencies.auditRepository,
    organizationId: pointer.organizationId,
    projectId: pointer.projectId,
    actor: { type: "user", id: actor.uid, role: null },
    action,
    target: { type: "timer", id: actor.uid },
    correlation,
    execute: async (transaction) => {
      const [pointerDoc, timerDoc] = await Promise.all([
        transaction.get(pointerRef),
        transaction.get(timerRef),
      ]);
      if (!pointerDoc.exists || !timerDoc.exists) throw new AuditedCommandError("failed", "timer_not_active", "No timer is active");
      const currentPointer = activeTimerPointerSchema.parse(pointerDoc.data());
      const timer = activeTimerSchema.parse(timerDoc.data());
      if (currentPointer.organizationId !== pointer.organizationId || currentPointer.projectId !== pointer.projectId || timer.userId !== actor.uid) {
        throw new AuditedCommandError("failed", "timer_state_conflict", "Timer state changed");
      }
      if (timer.state === nextState) return timer;
      if (nextState === "running" && timer.segments.length >= 100) {
        throw new AuditedCommandError("failed", "timer_segment_limit_reached", "Stop and restart this timer before continuing");
      }
      if (nextState === "paused" && timer.currentSegmentStartedAt) {
        const segmentStartedAt = timestampFromValue(timer.currentSegmentStartedAt);
        if (changedAt.toMillis() < segmentStartedAt.toMillis() || changedAt.toMillis() > serverNow.toMillis()) {
          throw new AuditedCommandError("failed", "timer_inactivity_time_invalid", "The inactivity time is outside the running segment");
        }
      }

      const updated = nextState === "paused"
        ? activeTimerSchema.parse({
            ...timer,
            state: "paused",
            accumulatedSeconds: timer.accumulatedSeconds + segmentSeconds(timer.currentSegmentStartedAt!, changedAt),
            currentSegmentStartedAt: null,
            segments: [...timer.segments, { startedAt: timer.currentSegmentStartedAt!, endedAt: changedAt }],
            pausedAt: changedAt,
            pauseReason: reason ?? "manual",
          })
        : activeTimerSchema.parse({
            ...timer,
            state: "running",
            currentSegmentStartedAt: changedAt,
            pausedAt: null,
            pauseReason: null,
          });
      transaction.update(timerRef, {
        state: updated.state,
        accumulatedSeconds: updated.accumulatedSeconds,
        currentSegmentStartedAt: updated.currentSegmentStartedAt,
        segments: updated.segments,
        pausedAt: updated.pausedAt,
        pauseReason: updated.pauseReason,
      });
      return updated;
    },
  });
}

export function pauseTimer(actor: AuthActor, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  return transitionTimer(actor, "paused", "manual", correlation, dependencies);
}

export function resumeTimer(actor: AuthActor, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  return transitionTimer(actor, "running", null, correlation, dependencies);
}

export function pauseTimerForInactivity(actor: AuthActor, effectiveAt: string, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const parsed = new Date(effectiveAt);
  if (Number.isNaN(parsed.getTime())) throw new AuditedCommandError("failed", "timer_inactivity_time_invalid", "The inactivity time is invalid");
  return transitionTimer(actor, "paused", "inactivity", correlation, dependencies, Timestamp.fromDate(parsed));
}

async function changeTimerAlarm(actor: AuthActor, action: "time.timer.alarm.configured" | "time.timer.alarm.triggered" | "time.timer.alarm.dismissed" | "time.timer.alarm.snoozed", update: (timer: ActiveTimer, now: Timestamp) => { timer: ActiveTimer; changed: boolean }, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const db = dependencies.db ?? getAdminDb();
  const repository = new TimeRepository(db);
  const pointer = await repository.getActiveTimerPointer(actor.uid);
  if (!pointer) throw new AuditedCommandError("failed", "timer_not_active", "No timer is active");
  const timerRef = repository.activeTimerReference(pointer.organizationId, pointer.projectId, actor.uid);
  const now = (dependencies.now ?? Timestamp.now)();
  return executeAuditedCommand<{ timer: ActiveTimer; changed: boolean }>({
    db, auditRepository: dependencies.auditRepository, organizationId: pointer.organizationId, projectId: pointer.projectId,
    actor: { type: "user", id: actor.uid, role: null }, action, target: { type: "timer", id: actor.uid }, correlation,
    execute: async (transaction) => {
      const snapshot = await transaction.get(timerRef);
      if (!snapshot.exists) throw new AuditedCommandError("failed", "timer_not_active", "No timer is active");
      const timer = activeTimerSchema.parse(snapshot.data());
      if (timer.userId !== actor.uid) throw new AuditedCommandError("denied", "timer_alarm_denied", "Timer alarm denied");
      const result = update(timer, now);
      if (result.changed) transaction.update(timerRef, { alarm: result.timer.alarm });
      return result;
    },
  });
}

export function configureTimerAlarm(actor: AuthActor, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = configureTimerAlarmCommandSchema.parse(raw);
  return changeTimerAlarm(actor, "time.timer.alarm.configured", (timer, now) => {
    const elapsed = trackedTimerSeconds(timer, now.toDate());
    const alarm = command.durationSeconds === null ? null : { durationSeconds: command.durationSeconds, dueAtTrackedSeconds: elapsed + command.durationSeconds, status: "armed" as const, triggeredAt: null, acknowledgedAt: null, snoozeCount: 0 };
    return { timer: activeTimerSchema.parse({ ...timer, alarm }), changed: true };
  }, correlation, dependencies);
}

export function claimDueTimerAlarm(actor: AuthActor, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  return changeTimerAlarm(actor, "time.timer.alarm.triggered", (timer, now) => {
    if (!timer.alarm || timer.alarm.status !== "armed" || trackedTimerSeconds(timer, now.toDate()) < timer.alarm.dueAtTrackedSeconds) return { timer, changed: false };
    return { timer: activeTimerSchema.parse({ ...timer, alarm: { ...timer.alarm, status: "due", triggeredAt: now } }), changed: true };
  }, correlation, dependencies);
}

export function dismissTimerAlarm(actor: AuthActor, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  return changeTimerAlarm(actor, "time.timer.alarm.dismissed", (timer, now) => {
    if (!timer.alarm || timer.alarm.status !== "due") return { timer, changed: false };
    return { timer: activeTimerSchema.parse({ ...timer, alarm: { ...timer.alarm, status: "acknowledged", acknowledgedAt: now } }), changed: true };
  }, correlation, dependencies);
}

export function snoozeTimerAlarm(actor: AuthActor, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = snoozeTimerAlarmCommandSchema.parse(raw);
  return changeTimerAlarm(actor, "time.timer.alarm.snoozed", (timer, now) => {
    if (!timer.alarm || timer.alarm.status !== "due") throw new AuditedCommandError("failed", "timer_alarm_not_due", "Timer alarm is not due");
    const elapsed = trackedTimerSeconds(timer, now.toDate());
    return { timer: activeTimerSchema.parse({ ...timer, alarm: { ...timer.alarm, durationSeconds: command.durationSeconds, dueAtTrackedSeconds: elapsed + command.durationSeconds, status: "armed", triggeredAt: null, acknowledgedAt: null, snoozeCount: timer.alarm.snoozeCount + 1 } }), changed: true };
  }, correlation, dependencies);
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

export async function stopTimer(actor: AuthActor, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}): Promise<{ entry: TimeEntry; taskCompleted: boolean }> {
  const command = stopTimerCommandSchema.parse(raw);
  const db = dependencies.db ?? getAdminDb();
  const repository = new TimeRepository(db);
  const pointer = await repository.getActiveTimerPointer(actor.uid);
  if (!pointer) throw new AuditedCommandError("failed", "timer_not_active", "No timer is active");
  const timerRef = repository.activeTimerReference(pointer.organizationId, pointer.projectId, actor.uid);
  const pointerRef = repository.activeTimerPointerReference(actor.uid);
  const entryRef = repository.timeEntriesCollection(pointer.organizationId, pointer.projectId).doc();
  const endedAt = (dependencies.now ?? Timestamp.now)();
  return executeAuditedCommand<{ entry: TimeEntry; taskCompleted: boolean }>({
    db, auditRepository: dependencies.auditRepository, organizationId: pointer.organizationId, projectId: pointer.projectId,
    actor: { type: "user", id: actor.uid, role: null }, action: "time.timer.stopped", target: { type: "timer", id: actor.uid }, correlation,
    additionalSuccessAudits: ({ entry, taskCompleted }) => [{ action: "time.entry.created", target: { type: "time-entry", id: entry.id }, changes: [{ field: "billable", to: entry.billable }, { field: "clientReportingStatus", to: entry.clientReportingStatus }] }, ...(taskCompleted && entry.taskId ? [{ action: "task.record.completed" as const, target: { type: "task" as const, id: entry.taskId }, changes: [{ field: "status" as const, to: "done" }] }] : [])],
    execute: async (transaction) => {
      const [currentPointer, timerDoc] = await Promise.all([transaction.get(pointerRef), transaction.get(timerRef)]);
      if (!currentPointer.exists || !timerDoc.exists) throw new AuditedCommandError("failed", "timer_not_active", "No timer is active");
      const parsedPointer = activeTimerPointerSchema.parse(currentPointer.data());
      const timer = activeTimerSchema.parse(timerDoc.data());
      if (parsedPointer.organizationId !== pointer.organizationId || parsedPointer.projectId !== pointer.projectId || timer.userId !== actor.uid) throw new AuditedCommandError("failed", "timer_state_conflict", "Timer state changed");
      let taskCompleted = false;
      if (command.completeTask) {
        if (!timer.taskId) throw new AuditedCommandError("failed", "timer_task_required", "This timer has no task to complete");
        const taskRef = db.doc(`organizations/${timer.organizationId}/projects/${timer.projectId}/tasks/${timer.taskId}`);
        const [memberDoc, assignmentDoc, projectDoc, taskDoc] = await Promise.all([
          transaction.get(db.doc(`organizations/${timer.organizationId}/members/${actor.uid}`)),
          transaction.get(db.doc(`organizations/${timer.organizationId}/projects/${timer.projectId}/projectMembers/${actor.uid}`)),
          transaction.get(db.doc(`organizations/${timer.organizationId}/projects/${timer.projectId}`)),
          transaction.get(taskRef),
        ]);
        const member = memberDoc.exists ? organizationMemberSchema.parse(memberDoc.data()) : null; const assignment = assignmentDoc.exists ? projectAssignmentSchema.parse(assignmentDoc.data()) : null;
        if (!hasCapability(member, "tasks.manage") || !canAccessProject(member, assignment)) throw new AuditedCommandError("denied", "task_manage_denied", "Task management denied");
        if (!projectDoc.exists) throw new AuditedCommandError("failed", "project_not_found", "Project not found");
        const project = projectSchema.parse({ id: projectDoc.id, ...projectDoc.data() });
        if (project.status !== "active" || !project.enabledTools.includes("todos")) throw new AuditedCommandError("denied", "project_tasks_read_only", "Project tasks are unavailable");
        if (!taskDoc.exists) throw new AuditedCommandError("failed", "timer_task_not_found", "Task not found");
        const task = projectTaskSchema.parse({ id: taskDoc.id, ...taskDoc.data() });
        if (task.archivedAt) throw new AuditedCommandError("denied", "task_archived", "Archived tasks are read-only");
        if (task.status !== "done") { transaction.update(taskRef, { status: "done", completedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }); taskCompleted = true; }
      }
      const finalSegments = timer.state === "running" && timer.currentSegmentStartedAt
        ? [...timer.segments, { startedAt: timer.currentSegmentStartedAt, endedAt }]
        : timer.segments;
      const duration = timer.state === "running" && timer.currentSegmentStartedAt
        ? timer.accumulatedSeconds + segmentSeconds(timer.currentSegmentStartedAt, endedAt)
        : timer.accumulatedSeconds;
      if (duration < 1) throw new AuditedCommandError("failed", "time_range_invalid", "Tracked time must be at least one second");
      if (duration > MAX_ENTRY_SECONDS) throw new AuditedCommandError("failed", "time_duration_unreasonable", "Time duration is unreasonable");
      const now = FieldValue.serverTimestamp();
      const entry = timeEntrySchema.parse({ id: entryRef.id, organizationId: timer.organizationId, projectId: timer.projectId, taskId: timer.taskId, userId: actor.uid, source: "timer", startedAt: timer.startedAt, endedAt, durationSeconds: duration, segments: finalSegments, note: command.note, billable: command.billable, clientReportingStatus: command.clientReportingStatus, correctionCount: 0, createdBy: actor.uid, createdAt: endedAt, updatedBy: actor.uid, updatedAt: endedAt });
      const { id: _entryId, ...storedEntry } = entry; void _entryId;
      transaction.create(entryRef, { ...storedEntry, createdAt: now, updatedAt: now });
      transaction.delete(timerRef); transaction.delete(pointerRef);
      return { entry, taskCompleted };
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
  const now = (dependencies.now ?? Timestamp.now)();
  const auditChanges = [
    ...(command.billable === undefined ? [] : [{ field: "billable", to: command.billable }]),
    ...(command.clientReportingStatus === undefined ? [] : [{ field: "clientReportingStatus", to: command.clientReportingStatus }]),
  ];
  return executeAuditedCommand<TimeEntry>({ db, auditRepository: dependencies.auditRepository, organizationId, projectId, actor: { type: "user", id: actor.uid, role: null }, action: "time.entry.corrected", target: { type: "time-entry", id: command.entryId }, correlation, changes: auditChanges, execute: async (transaction) => {
    const snapshot = await transaction.get(entryRef); if (!snapshot.exists) throw new AuditedCommandError("failed", "time_entry_not_found", "Time entry not found"); const existing = timeEntrySchema.parse({ id: snapshot.id, ...snapshot.data() });
    const taskId = command.taskId === undefined ? existing.taskId : command.taskId; const member = await requireTimeWriter(transaction, db, organizationId, projectId, actor.uid, taskId);
    if (member.role !== "admin" && existing.userId !== actor.uid) throw new AuditedCommandError("denied", "time_entry_correction_denied", "Time entry correction denied");
    const startedAt = command.startedAt ? Timestamp.fromDate(new Date(command.startedAt)) : new Timestamp(existing.startedAt.seconds, existing.startedAt.nanoseconds); const endedAt = command.endedAt ? Timestamp.fromDate(new Date(command.endedAt)) : new Timestamp(existing.endedAt.seconds, existing.endedAt.nanoseconds); const duration = durationSeconds(startedAt, endedAt, now);
    const timeChanged = command.startedAt !== undefined || command.endedAt !== undefined;
    const updated = timeEntrySchema.parse({ ...existing, taskId, startedAt, endedAt, durationSeconds: duration, segments: timeChanged ? [{ startedAt, endedAt }] : existing.segments, note: command.note === undefined ? existing.note : command.note, billable: command.billable ?? existing.billable, clientReportingStatus: command.clientReportingStatus ?? existing.clientReportingStatus, correctionCount: existing.correctionCount + 1, updatedBy: actor.uid, updatedAt: now });
    const patch: Record<string, unknown> = { correctionCount: updated.correctionCount, updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() };
    if (command.taskId !== undefined) patch.taskId = updated.taskId; if (command.startedAt !== undefined) patch.startedAt = startedAt; if (command.endedAt !== undefined) patch.endedAt = endedAt; if (timeChanged) { patch.durationSeconds = duration; patch.segments = updated.segments; } if (command.note !== undefined) patch.note = updated.note; if (command.billable !== undefined) patch.billable = updated.billable; if (command.clientReportingStatus !== undefined) patch.clientReportingStatus = updated.clientReportingStatus;
    transaction.update(entryRef, patch); return updated;
  }});
}
