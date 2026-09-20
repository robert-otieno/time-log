import "server-only";

import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { executeAuditedCommand } from "@/domain/audit/command";
import { invitationSchema, organizationMemberSchema, projectAssignmentSchema } from "@/domain/organizations/schemas";
import { notificationSchema, type Notification } from "@/domain/notifications/schemas";
import { projectTaskSchema } from "@/domain/tasks/schemas";
import { renderNotification } from "@/emails/templates";
import { getAdminDb } from "@/lib/firebase-admin";
import { getResendClient } from "@/lib/resend";
import { parseResendEnvironment } from "@/lib/resend-config";

const CLAIM_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 20;
type DeliveryDependencies = { db?: Firestore; resend?: ReturnType<typeof getResendClient>; now?: () => Date; claimId?: () => string };

function canClaim(notification: Notification, now: Date) {
  if (notification.status === "sent" || notification.status === "suppressed" || notification.attemptCount >= MAX_ATTEMPTS) return false;
  if (notification.nextAttemptAt && notification.nextAttemptAt.seconds * 1000 > now.getTime()) return false;
  return notification.status !== "processing" || !notification.claimExpiresAt || notification.claimExpiresAt.seconds * 1000 <= now.getTime();
}

async function resolveRecipient(db: Firestore, organizationId: string, notification: Notification, now: Date) {
  if (notification.type === "invitation") {
    const snapshot = await db.doc(`organizations/${organizationId}/invitations/${notification.id}`).get();
    if (!snapshot.exists) return null;
    const invitation = invitationSchema.parse({ id: snapshot.id, ...snapshot.data() });
    return invitation.status === "pending" && invitation.expiresAt.seconds * 1000 > now.getTime() ? notification.recipientEmail : null;
  }
  if (!notification.recipientUserId) return null;
  if (notification.type !== "assignment") return notification.recipientEmail;
  const [memberSnapshot, assignmentSnapshot, taskSnapshot] = await Promise.all([
    db.doc(`organizations/${organizationId}/members/${notification.recipientUserId}`).get(),
    db.doc(`organizations/${organizationId}/projects/${notification.projectId}/projectMembers/${notification.recipientUserId}`).get(),
    db.doc(`organizations/${organizationId}/projects/${notification.projectId}/tasks/${notification.taskId}`).get(),
  ]);
  if (!memberSnapshot.exists || !assignmentSnapshot.exists || !taskSnapshot.exists) return null;
  const member = organizationMemberSchema.parse(memberSnapshot.data());
  const assignment = projectAssignmentSchema.parse(assignmentSnapshot.data());
  const task = projectTaskSchema.parse({ id: taskSnapshot.id, ...taskSnapshot.data() });
  if (member.status !== "active" || member.role === "client" || !member.email || assignment.status !== "active" || task.archivedAt || !task.assigneeIds.includes(member.userId)) return null;
  return member.email;
}

async function complete(db: Firestore, organizationId: string, projectId: string | null, notificationId: string, claimId: string, status: "sent" | "failed" | "suppressed", values: Record<string, unknown>) {
  const reference = db.doc(`organizations/${organizationId}/notifications/${notificationId}`);
  const action = status === "sent" ? "notification.email.sent" : status === "suppressed" ? "notification.email.suppressed" : "notification.email.failed";
  await executeAuditedCommand({
    db, organizationId, projectId, actor: { type: "system", id: "resend-outbox", role: null }, action,
    target: { type: "notification", id: notificationId }, correlation: createRequestCorrelation(), changes: [{ field: "deliveryStatus", to: status }],
    execute: async (transaction) => {
      const current = await transaction.get(reference);
      if (!current.exists || current.data()?.claimId !== claimId) return;
      transaction.update(reference, { status, claimId: null, claimExpiresAt: null, updatedAt: FieldValue.serverTimestamp(), ...values });
    },
  });
}

export async function deliverNotification(organizationId: string, notificationId: string, dependencies: DeliveryDependencies = {}) {
  const db = dependencies.db ?? getAdminDb();
  const now = (dependencies.now ?? (() => new Date()))();
  const claimId = (dependencies.claimId ?? randomUUID)();
  const reference = db.doc(`organizations/${organizationId}/notifications/${notificationId}`);
  const claimed = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return { kind: "not_found" as const };
    const notification = notificationSchema.parse({ id: snapshot.id, ...snapshot.data() });
    if (notification.status === "sent") return { kind: "sent" as const };
    if (!canClaim(notification, now)) return { kind: "busy" as const };
    transaction.update(reference, { status: "processing", claimId, claimExpiresAt: Timestamp.fromMillis(now.getTime() + CLAIM_MS), attemptCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    return { kind: "claimed" as const, notification };
  });
  if (claimed.kind === "not_found") return { ok: false as const, code: "not_found" as const };
  if (claimed.kind === "sent") return { ok: true as const, alreadySent: true };
  if (claimed.kind === "busy") return { ok: false as const, code: "not_claimable" as const };

  const notification = claimed.notification;
  const projectId = "projectId" in notification ? notification.projectId : null;
  let recipientEmail: string | null;
  try {
    recipientEmail = await resolveRecipient(db, organizationId, notification, now);
  } catch {
    const delayMinutes = Math.min(60, 2 ** Math.min(notification.attemptCount, 6));
    await complete(db, organizationId, projectId, notificationId, claimId, "failed", { lastErrorCode: "recipient_resolution_error", nextAttemptAt: Timestamp.fromMillis(now.getTime() + delayMinutes * 60_000) });
    return { ok: false as const, code: "recipient_resolution_error" as const };
  }
  if (!recipientEmail) {
    await complete(db, organizationId, projectId, notificationId, claimId, "suppressed", { lastErrorCode: "recipient_ineligible", nextAttemptAt: null });
    return { ok: false as const, code: "suppressed" as const };
  }
  try {
    const rendered = renderNotification(notification);
    const { data, error } = await (dependencies.resend ?? getResendClient()).emails.send({ from: parseResendEnvironment(process.env).fromEmail, to: [recipientEmail], ...rendered }, { idempotencyKey: notification.idempotencyKey });
    if (error || !data?.id) throw new Error("provider_error");
    await complete(db, organizationId, projectId, notificationId, claimId, "sent", { providerMessageId: data.id, lastErrorCode: null, nextAttemptAt: null });
    return { ok: true as const, alreadySent: false };
  } catch {
    const delayMinutes = Math.min(60, 2 ** Math.min(notification.attemptCount, 6));
    await complete(db, organizationId, projectId, notificationId, claimId, "failed", { lastErrorCode: "provider_error", nextAttemptAt: Timestamp.fromMillis(now.getTime() + delayMinutes * 60_000) });
    return { ok: false as const, code: "provider_error" as const };
  }
}
