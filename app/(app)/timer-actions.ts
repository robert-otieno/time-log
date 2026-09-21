"use server";

import { z } from "zod";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError } from "@/domain/audit/command";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { getAccessibleProject, listAccessibleProjects } from "@/domain/projects/service";
import { createTask } from "@/domain/tasks/service";
import { TaskRepository } from "@/domain/tasks/repository";
import { correctTimeEntry, createManualTimeEntry, getActiveTimer, startTimer, stopTimer } from "@/domain/time/service";
import type { ActiveTimer, TimeEntry } from "@/domain/time/schemas";
import { TimeRepository } from "@/domain/time/repository";
import { getAdminDb } from "@/lib/firebase-admin";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export type TimerView = {
  organizationId: string;
  projectId: string;
  projectName: string;
  projectKey: string | null;
  taskId: string | null;
  taskTitle: string | null;
  note: string | null;
  startedAt: string;
  observedAt: string;
};

export type TimerLaunchProject = {
  id: string;
  name: string;
  key: string;
  canCreateTask: boolean;
  tasks: Array<{ id: string; title: string }>;
};

export type TimerLaunchOptions = {
  role: "admin" | "member";
  projects: TimerLaunchProject[];
};

export type TimeEntryView = { id: string; taskId: string | null; taskTitle: string | null; userId: string; source: "timer" | "manual"; startedAt: string; endedAt: string; durationSeconds: number; note: string | null; billable: boolean; clientReportingStatus: "internal" | "approved"; correctionCount: number; canCorrect: boolean };

function timestampToIso(timestamp: { seconds: number; nanoseconds: number }) {
  return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1_000_000).toISOString();
}

async function toTimerView(timer: ActiveTimer): Promise<TimerView> {
  const db = getAdminDb();
  const [project, task] = await Promise.all([
    db.doc(`organizations/${timer.organizationId}/projects/${timer.projectId}`).get(),
    timer.taskId ? db.doc(`organizations/${timer.organizationId}/projects/${timer.projectId}/tasks/${timer.taskId}`).get() : Promise.resolve(null),
  ]);
  return {
    organizationId: timer.organizationId,
    projectId: timer.projectId,
    projectName: typeof project.data()?.name === "string" ? project.data()!.name : "Unavailable project",
    projectKey: typeof project.data()?.key === "string" ? project.data()!.key : null,
    taskId: timer.taskId,
    taskTitle: typeof task?.data()?.title === "string" ? task.data()!.title : timer.taskId ? "Unavailable task" : null,
    note: timer.note,
    startedAt: timestampToIso(timer.startedAt),
    observedAt: new Date().toISOString(),
  };
}

function toEntryView(entry: TimeEntry, taskTitle: string | null, canCorrect: boolean): TimeEntryView {
  return { id: entry.id, taskId: entry.taskId, taskTitle, userId: entry.userId, source: entry.source, startedAt: timestampToIso(entry.startedAt), endedAt: timestampToIso(entry.endedAt), durationSeconds: entry.durationSeconds, note: entry.note, billable: entry.billable, clientReportingStatus: entry.clientReportingStatus, correctionCount: entry.correctionCount, canCorrect };
}

export async function loadTimerStateAction() {
  const actor = await getSessionActor();
  if (!actor) return { ok: false as const, code: "session_expired" as const };
  try {
    const timer = await getActiveTimer(actor);
    return { ok: true as const, timer: timer ? await toTimerView(timer) : null };
  } catch {
    return { ok: false as const, code: "timer_unavailable" as const };
  }
}

export async function loadTimerLaunchOptionsAction() {
  const actor = await getSessionActor();
  if (!actor) return { ok: false as const, code: "session_expired" as const };
  try {
    const organizationId = await getActiveOrganizationId(actor);
    const [projects, member] = await Promise.all([
      listAccessibleProjects(actor, organizationId),
      new OrganizationRepository().getMembership(organizationId, actor.uid),
    ]);
    if (!projects || !member || member.role === "client") return { ok: false as const, code: "timer_denied" as const };
    const repository = new TaskRepository();
    const availableProjects = projects.filter((project) => project.status === "active" && project.enabledTools.includes("time"));
    const options = await Promise.all(availableProjects.map(async (project) => {
      const tasks = await repository.list(organizationId, project.id, { includeArchived: false, statuses: ["backlog", "todo", "in_progress", "blocked"], limit: 100 }, { kind: "all" });
      return {
        id: project.id,
        name: project.name,
        key: project.key,
        canCreateTask: project.enabledTools.includes("todos"),
        tasks: tasks.map(({ id, title }) => ({ id, title })),
      };
    }));
    return { ok: true as const, options: { role: member.role, projects: options } satisfies TimerLaunchOptions };
  } catch {
    return { ok: false as const, code: "timer_unavailable" as const };
  }
}

const startInputSchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  taskId: z.string().trim().min(1).max(128).nullable(),
  note: z.string().trim().max(2000).nullable(),
}).strict();

export async function startTimerAction(raw: unknown) {
  const actor = await getSessionActor();
  if (!actor) return { ok: false as const, code: "session_expired" as const };
  try {
    const input = startInputSchema.parse(raw);
    const organizationId = await getActiveOrganizationId(actor);
    const timer = await startTimer(actor, organizationId, input.projectId, { taskId: input.taskId, note: input.note }, createRequestCorrelation());
    return { ok: true as const, timer: await toTimerView(timer) };
  } catch (error) {
    if (error instanceof AuditedCommandError) {
      if (error.reasonCode === "timer_already_active") return { ok: false as const, code: "timer_already_active" as const };
      if (error.reasonCode === "timer_task_required") return { ok: false as const, code: "timer_task_required" as const };
      if (error.outcome === "denied") return { ok: false as const, code: "timer_denied" as const };
    }
    return { ok: false as const, code: "timer_unavailable" as const };
  }
}

const quickTaskSchema = z.object({ projectId: z.string().trim().min(1).max(128), title: z.string().trim().min(1).max(240) }).strict();

export async function createTimerTaskAction(raw: unknown) {
  const actor = await getSessionActor();
  if (!actor) return { ok: false as const, code: "session_expired" as const };
  try {
    const input = quickTaskSchema.parse(raw);
    const organizationId = await getActiveOrganizationId(actor);
    const result = await createTask(actor, organizationId, input.projectId, {
      title: input.title,
      description: null,
      assigneeIds: [actor.uid],
      priority: "medium",
      dueDate: null,
      dueAt: null,
      dueTimeSet: false,
      visibility: "internal",
      parentTaskId: null,
      boardColumnId: null,
      sortOrder: Date.now(),
    }, createRequestCorrelation());
    return { ok: true as const, task: { id: result.id, title: input.title } };
  } catch {
    return { ok: false as const, code: "task_create_failed" as const };
  }
}

const entrySettingsSchema = z.object({ note: z.string().trim().max(2000).nullable(), billable: z.boolean(), clientReportingStatus: z.enum(["internal", "approved"]), completeTask: z.boolean().default(false) }).strict();

export async function stopTimerAction(raw: unknown) {
  const actor = await getSessionActor(); if (!actor) return { ok: false as const, code: "session_expired" as const };
  try { const result = await stopTimer(actor, entrySettingsSchema.parse(raw), createRequestCorrelation()); return { ok: true as const, entryId: result.entry.id, taskCompleted: result.taskCompleted }; }
  catch (error) { if (error instanceof AuditedCommandError) return { ok: false as const, code: error.reasonCode }; return { ok: false as const, code: "timer_stop_failed" as const }; }
}

const manualActionSchema = entrySettingsSchema.extend({ projectId: z.string().min(1).max(128), taskId: z.string().min(1).max(128).nullable(), startedAt: z.string().datetime({ offset: true }), endedAt: z.string().datetime({ offset: true }) }).strict();
export async function createManualTimeEntryAction(raw: unknown) {
  const actor = await getSessionActor(); if (!actor) return { ok: false as const, code: "session_expired" as const };
  try { const input = manualActionSchema.parse(raw); const organizationId = await getActiveOrganizationId(actor); const entry = await createManualTimeEntry(actor, organizationId, input.projectId, input, createRequestCorrelation()); return { ok: true as const, entryId: entry.id }; }
  catch (error) { if (error instanceof AuditedCommandError) return { ok: false as const, code: error.reasonCode }; return { ok: false as const, code: "time_entry_failed" as const }; }
}

const correctionActionSchema = manualActionSchema.extend({ entryId: z.string().min(1).max(128) }).strict();
export async function correctTimeEntryAction(raw: unknown) {
  const actor = await getSessionActor(); if (!actor) return { ok: false as const, code: "session_expired" as const };
  try { const input = correctionActionSchema.parse(raw); const organizationId = await getActiveOrganizationId(actor); const entry = await correctTimeEntry(actor, organizationId, input.projectId, input, createRequestCorrelation()); return { ok: true as const, entryId: entry.id }; }
  catch (error) { if (error instanceof AuditedCommandError) return { ok: false as const, code: error.reasonCode }; return { ok: false as const, code: "time_correction_failed" as const }; }
}

export async function loadProjectTimeData(projectId: string) {
  const actor = await getSessionActor(); if (!actor) return null;
  const organizationId = await getActiveOrganizationId(actor); const access = await getAccessibleProject(actor, organizationId, projectId);
  if (!access || access.role === "client" || !access.project.enabledTools.includes("time")) return null;
  const [entries, tasks] = await Promise.all([
    new TimeRepository().listRecentEntries(organizationId, projectId, 20),
    new TaskRepository().list(organizationId, projectId, { includeArchived: false, limit: 100 }, { kind: "all" }),
  ]);
  const taskTitles = new Map(tasks.map((task) => [task.id, task.title]));
  return { role: access.role, project: { id: projectId, name: access.project.name }, tasks: tasks.map(({ id, title }) => ({ id, title })), entries: entries.filter((entry) => access.role === "admin" || entry.userId === actor.uid).map((entry) => toEntryView(entry, entry.taskId ? taskTitles.get(entry.taskId) ?? "Unavailable task" : null, access.role === "admin" || entry.userId === actor.uid)) };
}
