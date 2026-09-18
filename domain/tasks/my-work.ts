import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { organizationMemberSchema, organizationSchema } from "@/domain/organizations/schemas";
import { listAccessibleProjects } from "@/domain/projects/service";
import { toTaskListItem, type TaskListItem } from "@/domain/tasks/form-data";
import { TaskRepository } from "@/domain/tasks/repository";
import { visibilityForQuery } from "@/domain/visibility/policy";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

export type MyWorkTask = TaskListItem & {
  project: { id: string; name: string; key: string; timeEnabled: boolean };
};

export type MyWorkGroups = {
  overdue: MyWorkTask[];
  today: MyWorkTask[];
  upcoming: MyWorkTask[];
  noDueDate: MyWorkTask[];
};

const unfinished = new Set(["backlog", "todo", "in_progress", "blocked"]);
const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

export function dateInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dueDate(task: MyWorkTask, timeZone: string) {
  return task.dueDate ?? (task.dueAt ? dateInTimeZone(new Date(task.dueAt), timeZone) : null);
}

function sortTasks(tasks: MyWorkTask[], timeZone: string) {
  return [...tasks].sort((left, right) => {
    const dateDifference = (dueDate(left, timeZone) ?? "9999-12-31").localeCompare(dueDate(right, timeZone) ?? "9999-12-31");
    if (dateDifference !== 0) return dateDifference;
    const priorityDifference = priorityOrder[left.priority] - priorityOrder[right.priority];
    return priorityDifference || left.project.name.localeCompare(right.project.name) || left.title.localeCompare(right.title);
  });
}

export function groupMyWorkTasks(tasks: MyWorkTask[], timeZone: string, now = new Date()): MyWorkGroups {
  const today = dateInTimeZone(now, timeZone);
  const groups: MyWorkGroups = { overdue: [], today: [], upcoming: [], noDueDate: [] };
  for (const task of tasks) {
    if (task.archivedAt || !unfinished.has(task.status)) continue;
    const date = dueDate(task, timeZone);
    if (!date) groups.noDueDate.push(task);
    else if (date < today) groups.overdue.push(task);
    else if (date === today) groups.today.push(task);
    else groups.upcoming.push(task);
  }
  return {
    overdue: sortTasks(groups.overdue, timeZone), today: sortTasks(groups.today, timeZone),
    upcoming: sortTasks(groups.upcoming, timeZone), noDueDate: sortTasks(groups.noDueDate, timeZone),
  };
}

export async function loadMyWork(actor: AuthActor, organizationId: string, db: Firestore = getAdminDb()) {
  const [organizationDoc, memberDoc, projects] = await Promise.all([
    db.doc(`organizations/${organizationId}`).get(),
    db.doc(`organizations/${organizationId}/members/${actor.uid}`).get(),
    listAccessibleProjects(actor, organizationId, db),
  ]);
  if (!organizationDoc.exists || !memberDoc.exists || !projects) return null;
  const organization = organizationSchema.parse({ id: organizationDoc.id, ...organizationDoc.data() });
  const member = organizationMemberSchema.parse(memberDoc.data());
  if (member.status !== "active") return null;
  if (member.role === "client") return { role: member.role, onboardingState: organization.onboardingState, timezone: organization.timezone, groups: groupMyWorkTasks([], organization.timezone) };

  const activeProjects = projects.filter((project) => project.status === "active" && project.enabledTools.includes("todos"));
  const repository = new TaskRepository(db);
  const results = await Promise.all(activeProjects.map(async (project) => {
    const tasks = await repository.list(organizationId, project.id, { assigneeId: actor.uid, limit: 100 }, visibilityForQuery(member));
    return tasks.map((task): MyWorkTask => ({ ...toTaskListItem(task), project: { id: project.id, name: project.name, key: project.key, timeEnabled: project.enabledTools.includes("time") } }));
  }));
  return { role: member.role, onboardingState: organization.onboardingState, timezone: organization.timezone, groups: groupMyWorkTasks(results.flat(), organization.timezone) };
}
