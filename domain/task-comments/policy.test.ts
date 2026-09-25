import { describe, expect, it } from "vitest";
import { canReadTaskComment } from "@/domain/task-comments/policy";
import type { OrganizationMember, ProjectAssignment } from "@/domain/organizations/schemas";
import type { ProjectTask } from "@/domain/tasks/schemas";
import type { TaskComment } from "@/domain/task-comments/schemas";

const stamp = { seconds: 1, nanoseconds: 0 };
const member = (userId: string, role: OrganizationMember["role"] = "member"): OrganizationMember => ({ userId, email: `${userId}@example.com`, displayName: userId, role, status: "active", clientId: role === "client" ? "client-1" : null, joinedAt: stamp });
const assignment = (userId: string, projectRole: "admin" | "member" = "member"): ProjectAssignment => ({ userId, projectRole, status: "active", assignedBy: "u1", assignedAt: stamp, removedAt: null });
const task = { id: "t1", projectId: "p1", title: "Draft", description: null, assigneeIds: ["u2"], status: "todo", priority: "medium", dueDate: null, dueAt: null, dueTimeSet: false, visibility: "client-visible", parentTaskId: null, boardColumnId: null, sortOrder: 0, completedAt: null, archivedAt: null, migrationSource: null, createdBy: "u1", createdAt: stamp, updatedBy: "u1", updatedAt: stamp } as ProjectTask;
const comment = (audience: TaskComment["audience"], audienceUserIds: string[] = []): TaskComment => ({ id: "c1", taskId: "t1", body: "Update", authorId: "u1", authorName: "u1", audienceOwnerId: "u1", parentCommentId: null, rootCommentId: null, audience, audienceUserIds, mentionedUserIds: [], createdAt: stamp, updatedAt: stamp, editedAt: null, deletedAt: null, deletedBy: null });

describe("task comment audience policy", () => {
  it("limits assignee and selected audiences", () => {
    expect(canReadTaskComment(comment("assignees"), task, member("u2"), assignment("u2"))).toBe(true);
    expect(canReadTaskComment(comment("assignees"), task, member("u3"), assignment("u3"))).toBe(false);
    expect(canReadTaskComment(comment("selected", ["u3"]), task, member("u3"), assignment("u3"))).toBe(true);
  });

  it("keeps private comments with the author and moderators", () => {
    expect(canReadTaskComment(comment("private"), task, member("u1"), assignment("u1"))).toBe(true);
    expect(canReadTaskComment(comment("private"), task, member("u3"), assignment("u3"))).toBe(false);
    expect(canReadTaskComment(comment("private"), task, member("u4"), assignment("u4", "admin"))).toBe(true);
    expect(canReadTaskComment({ ...comment("private"), id: "reply", authorId: "u4", audienceOwnerId: "u1", parentCommentId: "c1", rootCommentId: "c1" }, task, member("u1"), assignment("u1"))).toBe(true);
  });

  it("shows clients only client-visible discussion on a client-visible task", () => {
    expect(canReadTaskComment(comment("client_visible"), task, member("client", "client"), assignment("client"))).toBe(true);
    expect(canReadTaskComment(comment("project_team"), task, member("client", "client"), assignment("client"))).toBe(false);
    expect(canReadTaskComment(comment("client_visible"), { ...task, visibility: "internal" }, member("client", "client"), assignment("client"))).toBe(false);
  });
});
