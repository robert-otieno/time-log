import "server-only";

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { organizationMemberSchema, organizationSchema } from "@/domain/organizations/schemas";
import { onboardingStateSchema, weekdaySchema } from "@/domain/onboarding/schemas";
import { listAccessibleProjects } from "@/domain/projects/service";
import { TaskRepository } from "@/domain/tasks/repository";
import { TimeRepository } from "@/domain/time/repository";
import { zonedDateBoundary } from "@/domain/time/reporting";
import { trackedTimerSeconds } from "@/domain/time/service";
import type { ActiveTimer, TimeEntry } from "@/domain/time/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

const timestamp = z.custom<{ seconds: number; nanoseconds: number }>((value) => typeof value === "object" && value !== null && "seconds" in value && "nanoseconds" in value);
export const dashboardPeriodSchema = z.enum(["today", "week", "month"]);
export const workTargetSchema = z.object({ schemaVersion: z.literal(1), userId: z.string().min(1), dailyTargetMinutes: z.number().int().min(30).max(1440), workingDays: z.array(weekdaySchema).min(1).max(7), updatedAt: timestamp }).strict();
export const updateWorkTargetSchema = z.object({ dailyTargetMinutes: z.number().int().min(30).max(1440), workingDays: z.array(weekdaySchema).min(1).max(7) }).strict();
export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>;

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const iso = (value: { seconds: number; nanoseconds: number }) => new Date(value.seconds * 1000 + value.nanoseconds / 1e6).toISOString();
const seconds = (value: { seconds: number; nanoseconds: number }) => value.seconds + value.nanoseconds / 1e9;

function zonedParts(date: Date, timezone: string) {
  const values = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => values.find((part) => part.type === type)?.value ?? "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday: get("weekday").toLowerCase().slice(0, 3) };
}

export function dashboardRange(period: DashboardPeriod, timezone: string, now = new Date()) {
  const parts = zonedParts(now, timezone);
  const localToday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  let localStart = localToday;
  if (period === "week") {
    const weekday = weekdayKeys.indexOf(parts.weekday as typeof weekdayKeys[number]);
    localStart = new Date(localToday.getTime() - ((weekday + 6) % 7) * 86_400_000);
  } else if (period === "month") {
    localStart = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  }
  const startDate = localStart.toISOString().slice(0, 10);
  const todayDate = localToday.toISOString().slice(0, 10);
  return { start: zonedDateBoundary(startDate, timezone), end: zonedDateBoundary(todayDate, timezone, true) };
}

function overlapSeconds(entry: TimeEntry, start: Date, end: Date) {
  return entry.segments.reduce((total, segment) => total + Math.max(0, Math.min(seconds(segment.endedAt), end.getTime() / 1000) - Math.max(seconds(segment.startedAt), start.getTime() / 1000)), 0);
}

function inactiveSeconds(entry: TimeEntry, start: Date, end: Date) {
  if (entry.source !== "timer" || entry.segments.length < 2) return 0;
  return entry.segments.slice(1).reduce((total, segment, index) => total + Math.max(0, Math.min(seconds(segment.startedAt), end.getTime() / 1000) - Math.max(seconds(entry.segments[index].endedAt), start.getTime() / 1000)), 0);
}

function activeTimerOverlap(timer: ActiveTimer, start: Date, end: Date, now = new Date()) {
  const closed = timer.segments.reduce((total, segment) => total + Math.max(0, Math.min(seconds(segment.endedAt), end.getTime() / 1000) - Math.max(seconds(segment.startedAt), start.getTime() / 1000)), 0);
  if (timer.state !== "running" || !timer.currentSegmentStartedAt) return closed;
  return closed + Math.max(0, Math.min(now.getTime() / 1000, end.getTime() / 1000) - Math.max(seconds(timer.currentSegmentStartedAt), start.getTime() / 1000));
}

function activeTimerInactive(timer: ActiveTimer, start: Date, end: Date, now = new Date()) {
  const gaps = timer.segments.slice(1).reduce((total, segment, index) => total + Math.max(0, Math.min(seconds(segment.startedAt), end.getTime() / 1000) - Math.max(seconds(timer.segments[index].endedAt), start.getTime() / 1000)), 0);
  if (timer.state !== "paused" || !timer.pausedAt) return gaps;
  return gaps + Math.max(0, Math.min(now.getTime() / 1000, end.getTime() / 1000) - Math.max(seconds(timer.pausedAt), start.getTime() / 1000));
}

function countTargetDays(start: Date, end: Date, timezone: string, days: string[]) {
  let count = 0;
  for (let cursor = start; cursor < end; cursor = new Date(cursor.getTime() + 86_400_000)) if (days.includes(zonedParts(new Date(cursor.getTime() + 43_200_000), timezone).weekday)) count++;
  return count;
}

async function defaults(actor: AuthActor, organizationId: string, timezone: string, db: Firestore) {
  const snapshot = await db.doc(`organizations/${organizationId}/onboarding/${actor.uid}`).get();
  const state = snapshot.exists ? onboardingStateSchema.parse(snapshot.data()) : null;
  const hours = state?.profile?.workingHours;
  const [startHour, startMinute] = (hours?.start ?? "09:00").split(":").map(Number);
  const [endHour, endMinute] = (hours?.end ?? "17:00").split(":").map(Number);
  return { dailyTargetMinutes: Math.max(30, endHour * 60 + endMinute - startHour * 60 - startMinute), workingDays: hours?.days ?? ["mon", "tue", "wed", "thu", "fri"], timezone };
}

export async function loadWorkDashboard(actor: AuthActor, organizationId: string, periodRaw: unknown, db: Firestore = getAdminDb()) {
  const period = dashboardPeriodSchema.parse(periodRaw);
  const [organizationSnapshot, memberSnapshot, projects, targetSnapshot] = await Promise.all([
    db.doc(`organizations/${organizationId}`).get(), db.doc(`organizations/${organizationId}/members/${actor.uid}`).get(), listAccessibleProjects(actor, organizationId, db), db.doc(`users/${actor.uid}/preferences/work-target`).get(),
  ]);
  if (!organizationSnapshot.exists || !memberSnapshot.exists || !projects) return null;
  const organization = organizationSchema.parse({ id: organizationSnapshot.id, ...organizationSnapshot.data() });
  const member = organizationMemberSchema.parse(memberSnapshot.data());
  if (member.status !== "active" || member.role === "client") return null;
  const fallback = await defaults(actor, organizationId, organization.timezone, db);
  const target = targetSnapshot.exists ? workTargetSchema.parse(targetSnapshot.data()) : { schemaVersion: 1 as const, userId: actor.uid, ...fallback, updatedAt: null };
  const range = dashboardRange(period, organization.timezone);
  const available = projects.filter((project) => project.status === "active");
  const timeProjects = available.filter((project) => project.enabledTools.includes("time"));
  const taskProjects = available.filter((project) => project.enabledTools.includes("todos"));
  const timeRepository = new TimeRepository(db); const taskRepository = new TaskRepository(db);
  const [entryGroups, taskGroups, activeTimer] = await Promise.all([
    Promise.all(timeProjects.map(async (project) => ({ project, ...(await timeRepository.listEntriesOverlapping(organizationId, project.id, range.start, range.end)) }))),
    Promise.all(taskProjects.map(async (project) => ({ project, tasks: await taskRepository.list(organizationId, project.id, { includeArchived: true, limit: 100 }, { kind: "all" }) }))),
    timeRepository.getActiveTimer(actor.uid),
  ]);
  const entries = entryGroups.flatMap(({ project, entries: values }) => values.filter((entry) => entry.userId === actor.uid).map((entry) => ({ entry, project })));
  const tasks = taskGroups.flatMap(({ tasks }) => tasks);
  const assignedTasks = tasks.filter((task) => task.assigneeIds.includes(actor.uid));
  const taskTitles = new Map(tasks.map((task) => [task.id, task.title]));
  const eligibleActiveTimer = activeTimer && activeTimer.organizationId === organizationId && timeProjects.some((project) => project.id === activeTimer.projectId) ? activeTimer : null;
  const persistedSeconds = Math.round(entries.reduce((total, { entry }) => total + overlapSeconds(entry, range.start, range.end), 0));
  const currentSeconds = eligibleActiveTimer ? Math.round(activeTimerOverlap(eligibleActiveTimer, range.start, range.end)) : 0;
  const inactive = Math.round(entries.reduce((total, { entry }) => total + inactiveSeconds(entry, range.start, range.end), 0) + (eligibleActiveTimer ? activeTimerInactive(eligibleActiveTimer, range.start, range.end) : 0));
  const completed = assignedTasks.filter((task) => task.completedAt && seconds(task.completedAt) >= range.start.getTime() / 1000 && seconds(task.completedAt) < range.end.getTime() / 1000).length;
  const inProgress = assignedTasks.filter((task) => !task.archivedAt && task.status === "in_progress").length;
  const targetSeconds = countTargetDays(range.start, range.end, organization.timezone, target.workingDays) * target.dailyTargetMinutes * 60;
  const liveProject = eligibleActiveTimer ? timeProjects.find((project) => project.id === eligibleActiveTimer.projectId) : null;
  return {
    period, timezone: organization.timezone, observedAt: new Date().toISOString(), range: { start: range.start.toISOString(), end: range.end.toISOString() },
    trackedSeconds: persistedSeconds + currentSeconds, persistedSeconds, inactiveSeconds: inactive, completedTasks: completed, inProgressTasks: inProgress,
    sessionCount: entries.filter(({ entry }) => entry.source === "timer").length + (eligibleActiveTimer ? 1 : 0), target: { dailyTargetMinutes: target.dailyTargetMinutes, workingDays: target.workingDays, periodTargetSeconds: targetSeconds },
    activeTimer: eligibleActiveTimer ? { state: eligibleActiveTimer.state, elapsedSeconds: trackedTimerSeconds(eligibleActiveTimer), observedAt: new Date().toISOString(), projectName: liveProject?.name ?? "Unavailable project", taskTitle: eligibleActiveTimer.taskId ? taskTitles.get(eligibleActiveTimer.taskId) ?? "Unavailable task" : "Project-level work" } : null,
    recentLogs: entries.sort((a, b) => b.entry.startedAt.seconds - a.entry.startedAt.seconds).slice(0, 8).map(({ entry, project }) => ({ id: entry.id, projectName: project.name, taskTitle: entry.taskId ? taskTitles.get(entry.taskId) ?? "Unavailable task" : "Project-level work", startedAt: iso(entry.startedAt), durationSeconds: entry.durationSeconds, source: entry.source })),
    timeline: entries.filter(({ entry }) => entry.source === "timer").flatMap(({ entry, project }) => entry.segments.map((segment) => ({ id: `${entry.id}-${segment.startedAt.seconds}`, projectName: project.name, taskTitle: entry.taskId ? taskTitles.get(entry.taskId) ?? "Unavailable task" : "Project-level work", startedAt: iso(segment.startedAt), endedAt: iso(segment.endedAt) }))).sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
  };
}

export async function updateWorkTarget(actor: AuthActor, organizationId: string, raw: unknown, correlation: AuditCorrelation, dependencies: { db?: Firestore; auditRepository?: AuditWriter } = {}) {
  const input = updateWorkTargetSchema.parse(raw); const db = dependencies.db ?? getAdminDb();
  const memberRef = db.doc(`organizations/${organizationId}/members/${actor.uid}`); const targetRef = db.doc(`users/${actor.uid}/preferences/work-target`);
  return executeAuditedCommand({ db, auditRepository: dependencies.auditRepository, organizationId, projectId: null, actor: { type: "user", id: actor.uid, role: null }, action: "user.preferences.updated", target: { type: "preference", id: actor.uid }, correlation, changes: [{ field: "workTargetChanged", to: true }], execute: async (transaction) => {
    const membership = await transaction.get(memberRef); if (!membership.exists || organizationMemberSchema.parse(membership.data()).status !== "active") throw new AuditedCommandError("denied", "preferences_update_denied", "Preference update denied");
    transaction.set(targetRef, { schemaVersion: 1, userId: actor.uid, ...input, updatedAt: FieldValue.serverTimestamp() }); return input;
  }});
}
