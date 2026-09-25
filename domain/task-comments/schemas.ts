import { z } from "zod";

const id = z.string().trim().min(1).max(128);
const timestamp = z.custom<{ seconds: number; nanoseconds: number }>((value) => typeof value === "object" && value !== null && "seconds" in value && "nanoseconds" in value);
export const taskCommentAudienceSchema = z.enum(["project_team", "assignees", "selected", "private", "client_visible"]);

export const taskCommentSchema = z.object({
  id, taskId: id, body: z.string().trim().max(5000), authorId: id, authorName: z.string().trim().min(1).max(120),
  audienceOwnerId: id,
  parentCommentId: id.nullable(), rootCommentId: id.nullable(), audience: taskCommentAudienceSchema,
  audienceUserIds: z.array(id).max(50), mentionedUserIds: z.array(id).max(20), createdAt: timestamp,
  updatedAt: timestamp, editedAt: timestamp.nullable(), deletedAt: timestamp.nullable(), deletedBy: id.nullable(),
}).strict().superRefine((comment, context) => {
  if ((comment.audience === "selected") !== (comment.audienceUserIds.length > 0)) context.addIssue({ code: "custom", path: ["audienceUserIds"], message: "Selected comments require recipients and other audiences must not store recipients" });
  if (comment.parentCommentId === null && comment.rootCommentId !== null) context.addIssue({ code: "custom", path: ["rootCommentId"], message: "Root comments cannot reference a root" });
  if (comment.parentCommentId !== null && comment.rootCommentId === null) context.addIssue({ code: "custom", path: ["rootCommentId"], message: "Replies require a root" });
});

const content = { body: z.string().trim().min(1).max(5000), mentionedUserIds: z.array(id).max(20).default([]).transform((values) => [...new Set(values)]) };
export const createTaskCommentCommandSchema = z.object({ taskId: id, parentCommentId: id.nullable().default(null), audience: taskCommentAudienceSchema.default("project_team"), audienceUserIds: z.array(id).max(50).default([]).transform((values) => [...new Set(values)]), ...content }).strict();
export const updateTaskCommentCommandSchema = z.object({ taskId: id, commentId: id, ...content }).strict();
export const deleteTaskCommentCommandSchema = z.object({ taskId: id, commentId: id }).strict();
export type TaskComment = z.infer<typeof taskCommentSchema>;
export type TaskCommentAudience = z.infer<typeof taskCommentAudienceSchema>;
export type TaskCommentView = Omit<TaskComment, "createdAt" | "updatedAt" | "editedAt" | "deletedAt"> & { createdAt: string; updatedAt: string; editedAt: string | null; deletedAt: string | null; canEdit: boolean; canDelete: boolean };
