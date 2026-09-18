import type { ProjectTask } from "@/domain/tasks/schemas";

export type TaskListItem = {
  id: string; title: string; description: string | null; assigneeIds: string[];
  status: ProjectTask["status"]; priority: ProjectTask["priority"]; dueDate: string | null; dueAt: string | null;
  dueTimeSet: boolean; visibility: ProjectTask["visibility"]; parentTaskId: string | null; sortOrder: number;
  archivedAt: string | null;
};

export function toTaskListItem(task: ProjectTask, clientView = false): TaskListItem {
  const dueAt = task.dueAt ? new Date(task.dueAt.seconds * 1000 + task.dueAt.nanoseconds / 1e6).toISOString() : null;
  const archivedAt = task.archivedAt ? new Date(task.archivedAt.seconds * 1000 + task.archivedAt.nanoseconds / 1e6).toISOString() : null;
  return { id: task.id, title: task.title, description: task.description, assigneeIds: clientView ? [] : [...task.assigneeIds], status: task.status, priority: task.priority, dueDate: task.dueDate, dueAt, dueTimeSet: task.dueTimeSet, visibility: task.visibility, parentTaskId: task.parentTaskId, sortOrder: task.sortOrder, archivedAt };
}
