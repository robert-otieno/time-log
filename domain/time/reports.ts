import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { AUDIT_SCHEMA_VERSION } from "@/domain/audit/schemas";
import { AuditRepository, type AuditAppendResult } from "@/domain/audit/repository";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { organizationMemberSchema } from "@/domain/organizations/schemas";
import { getAccessibleProject, listAccessibleProjects } from "@/domain/projects/service";
import { projectTaskSchema } from "@/domain/tasks/schemas";
import { TimeRepository } from "@/domain/time/repository";
import { defaultWeekDates, filterTimeEntries, timeReportFiltersSchema, zonedDateBoundary, type TimeReportFilters, type TimeReportRow } from "@/domain/time/reporting";
import type { TimeEntry } from "@/domain/time/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

type ReportRole = "admin" | "member" | "client";
type ReportDependencies = { db?: Firestore; timeRepository?: TimeRepository; auditRepository?: AuditRepository };

function timestampToIso(timestamp: { seconds: number; nanoseconds: number }) {
  return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1_000_000).toISOString();
}

async function reportLookups(db: Firestore, organizationId: string, projectId: string) {
  const [tasks, members] = await Promise.all([
    db.collection(`organizations/${organizationId}/projects/${projectId}/tasks`).get(),
    db.collection(`organizations/${organizationId}/members`).get(),
  ]);
  return {
    taskTitles: new Map(tasks.docs.map((document) => { const task = projectTaskSchema.parse({ id: document.id, ...document.data() }); return [task.id, task.title]; })),
    memberNames: new Map(members.docs.map((document) => { const member = organizationMemberSchema.parse(document.data()); return [member.userId, member.displayName ?? member.email ?? "Team member"]; })),
  };
}

function toRows(entries: TimeEntry[], projectId: string, projectName: string, taskTitles: Map<string, string>, memberNames: Map<string, string>): TimeReportRow[] {
  return entries.map((entry) => ({
    id: entry.id,
    projectId,
    projectName,
    taskId: entry.taskId,
    taskTitle: entry.taskId ? taskTitles.get(entry.taskId) ?? "Unavailable task" : "Project-level work",
    userId: entry.userId,
    userName: memberNames.get(entry.userId) ?? "Team member",
    startedAt: timestampToIso(entry.startedAt),
    durationSeconds: entry.durationSeconds,
    billable: entry.billable,
    reportingStatus: entry.clientReportingStatus,
  }));
}

async function appendReportAudit(actor: AuthActor, role: ReportRole, organizationId: string, projectId: string, action: "time.report.previewed" | "time.report.exported", correlation: AuditCorrelation, repository: AuditRepository): Promise<AuditAppendResult> {
  return repository.append({ organizationId, projectId, actor: { type: "user", id: actor.uid, role }, action, target: { type: "project", id: projectId }, outcome: "succeeded", changes: [], reasonCode: null, requestId: correlation.requestId, runId: correlation.runId, ipHash: null, userAgentSummary: null, schemaVersion: AUDIT_SCHEMA_VERSION });
}

export async function loadProjectTimeReport(actor: AuthActor, organizationId: string, projectId: string, rawFilters: unknown, timezone: string, correlation?: AuditCorrelation, dependencies: ReportDependencies = {}) {
  const db = dependencies.db ?? getAdminDb();
  const filters = timeReportFiltersSchema.parse(rawFilters);
  const access = await getAccessibleProject(actor, organizationId, projectId, db);
  if (!access || !access.project.enabledTools.includes("time")) return null;
  const repository = dependencies.timeRepository ?? new TimeRepository(db);
  const [entryResult, lookups] = await Promise.all([
    repository.listEntriesBetween(organizationId, projectId, zonedDateBoundary(filters.startDate, timezone), zonedDateBoundary(filters.endDate, timezone, true)),
    reportLookups(db, organizationId, projectId),
  ]);
  const scoped = filterTimeEntries(entryResult.entries, filters, access.role === "member" ? actor.uid : undefined, access.role === "client");
  const rows = toRows(scoped, projectId, access.project.name, lookups.taskTitles, lookups.memberNames);
  if (correlation) await appendReportAudit(actor, access.role, organizationId, projectId, "time.report.previewed", correlation, dependencies.auditRepository ?? new AuditRepository(db));
  const clientTaskIds = access.role === "client" ? new Set(rows.map((row) => row.taskId).filter((id): id is string => id !== null)) : null;
  return {
    role: access.role,
    timezone,
    project: { id: projectId, name: access.project.name },
    filters,
    truncated: entryResult.truncated,
    rows,
    tasks: [...lookups.taskTitles].filter(([id]) => !clientTaskIds || clientTaskIds.has(id)).map(([id, title]) => ({ id, title })),
    users: access.role === "admin" ? [...lookups.memberNames].map(([id, name]) => ({ id, name })) : [],
  };
}

export async function loadPersonalTimeReport(actor: AuthActor, organizationId: string, rawFilters: unknown, timezone: string, dependencies: ReportDependencies = {}) {
  const db = dependencies.db ?? getAdminDb();
  const filters = timeReportFiltersSchema.parse(rawFilters);
  const projects = (await listAccessibleProjects(actor, organizationId, db))?.filter((project) => project.enabledTools.includes("time")) ?? [];
  const repository = dependencies.timeRepository ?? new TimeRepository(db);
  const start = zonedDateBoundary(filters.startDate, timezone); const end = zonedDateBoundary(filters.endDate, timezone, true);
  const results = await Promise.all(projects.map(async (project) => {
    const [entryResult, lookups] = await Promise.all([repository.listEntriesBetween(organizationId, project.id, start, end), reportLookups(db, organizationId, project.id)]);
    return { rows: toRows(filterTimeEntries(entryResult.entries, filters, actor.uid), project.id, project.name, lookups.taskTitles, lookups.memberNames), tasks: [...lookups.taskTitles].map(([id, title]) => ({ id, title: `${project.name} · ${title}` })), truncated: entryResult.truncated };
  }));
  return { timezone, filters, rows: results.flatMap((result) => result.rows).sort((a, b) => b.startedAt.localeCompare(a.startedAt)), tasks: results.flatMap((result) => result.tasks), projects: projects.map(({ id, name }) => ({ id, name })), truncated: results.some((result) => result.truncated) };
}

export async function auditTimeReportExport(actor: AuthActor, role: ReportRole, organizationId: string, projectId: string, correlation: AuditCorrelation, dependencies: ReportDependencies = {}) {
  return appendReportAudit(actor, role, organizationId, projectId, "time.report.exported", correlation, dependencies.auditRepository ?? new AuditRepository(dependencies.db ?? getAdminDb()));
}

export function reportFiltersFromSearch(search: Record<string, string | string[] | undefined>, timezone: string, now = new Date()): TimeReportFilters {
  const defaults = defaultWeekDates(now, timezone);
  const value = (key: string) => typeof search[key] === "string" ? search[key] : undefined;
  const parsed = timeReportFiltersSchema.safeParse({ startDate: value("startDate") ?? defaults.startDate, endDate: value("endDate") ?? defaults.endDate, userId: value("userId"), taskId: value("taskId"), billable: value("billable") ?? "all", reportingStatus: value("reportingStatus") ?? "all" });
  return parsed.success ? parsed.data : { ...defaults, billable: "all", reportingStatus: "all" };
}
