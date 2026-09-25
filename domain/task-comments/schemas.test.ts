import { describe, expect, it } from "vitest";
import { createTaskCommentCommandSchema, taskCommentSchema } from "@/domain/task-comments/schemas";

const timestamp = { seconds: 1, nanoseconds: 0 };
const base = { id: "c1", taskId: "t1", body: "Update", authorId: "u1", authorName: "Casey", audienceOwnerId: "u1", parentCommentId: null, rootCommentId: null, audience: "project_team", audienceUserIds: [], mentionedUserIds: [], createdAt: timestamp, updatedAt: timestamp, editedAt: null, deletedAt: null, deletedBy: null };

describe("task comment schemas", () => {
  it("accepts a root comment and a one-level reply reference", () => {
    expect(taskCommentSchema.parse(base).id).toBe("c1");
    expect(taskCommentSchema.parse({ ...base, id: "c2", parentCommentId: "c1", rootCommentId: "c1" }).rootCommentId).toBe("c1");
  });

  it("requires selected recipients only for the selected audience", () => {
    expect(taskCommentSchema.safeParse({ ...base, audience: "selected", audienceUserIds: [] }).success).toBe(false);
    expect(taskCommentSchema.safeParse({ ...base, audience: "private", audienceUserIds: ["u2"] }).success).toBe(false);
  });

  it("deduplicates selected and mentioned users at the command boundary", () => {
    const command = createTaskCommentCommandSchema.parse({ taskId: "t1", body: "Hello", parentCommentId: null, audience: "selected", audienceUserIds: ["u2", "u2"], mentionedUserIds: ["u3", "u3"] });
    expect(command.audienceUserIds).toEqual(["u2"]); expect(command.mentionedUserIds).toEqual(["u3"]);
  });
});
