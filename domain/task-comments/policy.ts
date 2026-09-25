import type { OrganizationMember, ProjectAssignment } from "@/domain/organizations/schemas";
import type { ProjectTask } from "@/domain/tasks/schemas";
import type { TaskComment } from "@/domain/task-comments/schemas";
import { canManageProject } from "@/domain/organizations/policy";

export function canReadTaskComment(comment: TaskComment, task: ProjectTask, member: OrganizationMember, assignment: ProjectAssignment | null) {
  if (member.role === "admin" || canManageProject(member, assignment) || comment.authorId === member.userId || comment.audienceOwnerId === member.userId) return true;
  if (member.role === "client") return task.visibility === "client-visible" && comment.audience === "client_visible";
  if (comment.audience === "client_visible" || comment.audience === "project_team") return true;
  if (comment.audience === "assignees") return task.assigneeIds.includes(member.userId);
  if (comment.audience === "selected") return comment.audienceUserIds.includes(member.userId);
  return false;
}

export function canModerateTaskComments(member: OrganizationMember, assignment: ProjectAssignment | null) {
  return member.role === "admin" || canManageProject(member, assignment);
}
