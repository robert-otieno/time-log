import "server-only";

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { canAccessProject, hasCapability } from "@/domain/organizations/policy";
import { organizationMemberSchema, projectAssignmentSchema, projectSchema } from "@/domain/organizations/schemas";
import { projectTaskSchema } from "@/domain/tasks/schemas";
import { activeTimerSchema, startTimerCommandSchema, type ActiveTimer } from "@/domain/time/schemas";
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
