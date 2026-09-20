import { z } from "zod";

const id = z.string().trim().min(1).max(128);
const timestamp = z.custom<{ seconds: number; nanoseconds: number }>(
  (value) => typeof value === "object" && value !== null && "seconds" in value && "nanoseconds" in value,
  "Expected a Firestore timestamp",
);
const nullableTimestamp = timestamp.nullable().default(null);
const common = {
  id,
  recipientEmail: z.string().trim().toLowerCase().email().nullable().default(null),
  recipientUserId: id.nullable().default(null),
  status: z.enum(["queued", "processing", "sent", "failed", "suppressed"]),
  idempotencyKey: z.string().trim().min(1).max(256),
  providerMessageId: z.string().min(1).nullable(),
  providerStatus: z.enum(["sent", "delivered", "delivery_delayed", "bounced", "complained", "failed", "suppressed"]).nullable().default(null),
  providerEventAt: nullableTimestamp,
  attemptCount: z.number().int().min(0).max(20),
  lastErrorCode: z.string().trim().min(1).max(64).nullable(),
  claimId: id.nullable().default(null),
  claimExpiresAt: nullableTimestamp,
  nextAttemptAt: nullableTimestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const url = z.string().url().max(2048);
const name = z.string().trim().min(1).max(120);
const title = z.string().trim().min(1).max(240);

export const notificationSchema = z.discriminatedUnion("type", [
  z.object({ ...common, type: z.literal("invitation"), templateData: z.object({ organizationName: name, inviterName: name, acceptUrl: url }).strict() }).strict(),
  z.object({ ...common, type: z.literal("assignment"), projectId: id, taskId: id, templateData: z.object({ organizationName: name, projectName: name, taskTitle: title, assignedByName: name, taskUrl: url }).strict() }).strict(),
  z.object({ ...common, type: z.literal("mention"), projectId: id, templateData: z.object({ projectName: name, authorName: name, contextLabel: title, targetUrl: url }).strict() }).strict(),
  z.object({ ...common, type: z.literal("reminder"), projectId: id, taskId: id, templateData: z.object({ projectName: name, itemTitle: title, dueLabel: z.string().trim().min(1).max(120), targetUrl: url }).strict() }).strict(),
  z.object({ ...common, type: z.literal("announcement"), projectId: id, templateData: z.object({ projectName: name, announcementTitle: title, authorName: name, targetUrl: url }).strict() }).strict(),
  z.object({ ...common, type: z.literal("digest"), templateData: z.object({ organizationName: name, periodLabel: z.string().trim().min(1).max(120), summary: z.string().trim().min(1).max(1000), targetUrl: url }).strict() }).strict(),
]);

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationType = Notification["type"];
