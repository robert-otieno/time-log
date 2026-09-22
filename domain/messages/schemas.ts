import { z } from "zod";
import { visibilitySchema } from "@/domain/visibility/schemas";

const id = z.string().trim().min(1).max(128);
const timestamp = z.custom<{ seconds: number; nanoseconds: number }>((value) => typeof value === "object" && value !== null && "seconds" in value && "nanoseconds" in value);

export const messagePostSchema = z.object({
  id, title: z.string().trim().min(1).max(180), body: z.string().trim().min(1).max(10_000),
  authorId: id, authorName: z.string().trim().min(1).max(120), visibility: visibilitySchema,
  announcement: z.boolean(), pinnedAt: timestamp.nullable(), pinnedBy: id.nullable(),
  createdAt: timestamp, updatedAt: timestamp, editedAt: timestamp.nullable(), archivedAt: timestamp.nullable(),
}).strict();

export const messageCommentSchema = z.object({
  id, postId: id, body: z.string().trim().min(1).max(5_000), authorId: id,
  authorName: z.string().trim().min(1).max(120), visibility: visibilitySchema,
  createdAt: timestamp, updatedAt: timestamp, editedAt: timestamp.nullable(), archivedAt: timestamp.nullable(),
}).strict();

export const createPostCommandSchema = z.object({ title: z.string().trim().min(1).max(180), body: z.string().trim().min(1).max(10_000), visibility: visibilitySchema.default("internal"), emailAnnouncement: z.boolean().default(false) }).strict();
export const updatePostCommandSchema = z.object({ postId: id, title: z.string().trim().min(1).max(180), body: z.string().trim().min(1).max(10_000) }).strict();
export const createCommentCommandSchema = z.object({ postId: id, body: z.string().trim().min(1).max(5_000) }).strict();
export const updateCommentCommandSchema = z.object({ postId: id, commentId: id, body: z.string().trim().min(1).max(5_000) }).strict();
export const messageTargetCommandSchema = z.object({ postId: id }).strict();
export const commentTargetCommandSchema = z.object({ postId: id, commentId: id }).strict();

export type MessagePost = z.infer<typeof messagePostSchema>;
export type MessageComment = z.infer<typeof messageCommentSchema>;
export type MessageBoardPost = Omit<MessagePost, "createdAt" | "updatedAt" | "editedAt" | "archivedAt" | "pinnedAt"> & { createdAt: string; updatedAt: string; editedAt: string | null; archivedAt: string | null; pinnedAt: string | null; comments: Array<Omit<MessageComment, "createdAt" | "updatedAt" | "editedAt" | "archivedAt"> & { createdAt: string; updatedAt: string; editedAt: string | null; archivedAt: string | null }> };
