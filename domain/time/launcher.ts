import type { ProjectTask } from "@/domain/tasks/schemas";

type RecommendationTask = Pick<
  ProjectTask,
  | "assigneeIds"
  | "dueDate"
  | "id"
  | "priority"
  | "sortOrder"
  | "status"
  | "title"
>;

const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

export function rankTimerTasks<T extends RecommendationTask>(
  tasks: readonly T[],
  userId: string,
) {
  return [...tasks].sort((left, right) => {
    const assignmentDifference =
      Number(!left.assigneeIds.includes(userId)) -
      Number(!right.assigneeIds.includes(userId));
    if (assignmentDifference !== 0) return assignmentDifference;

    const statusDifference =
      Number(left.status !== "in_progress") -
      Number(right.status !== "in_progress");
    if (statusDifference !== 0) return statusDifference;

    const dueDifference = (left.dueDate ?? "9999-12-31").localeCompare(
      right.dueDate ?? "9999-12-31",
    );
    if (dueDifference !== 0) return dueDifference;

    const priorityDifference =
      priorityRank[left.priority] - priorityRank[right.priority];
    return (
      priorityDifference ||
      left.sortOrder - right.sortOrder ||
      left.title.localeCompare(right.title) ||
      left.id.localeCompare(right.id)
    );
  });
}

export function projectIdFromProjectPath(pathname: string) {
  return pathname.match(/^\/projects\/([^/]+)(?:\/|$)/)?.[1] ?? null;
}
