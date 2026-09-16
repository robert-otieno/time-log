import "server-only";

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { executeAuditedCommand } from "@/domain/audit/command";
import { notificationSchema } from "@/domain/organizations/schemas";
import { getAdminDb } from "@/lib/firebase-admin";
import { getResendClient } from "@/lib/resend";
import { parseResendEnvironment } from "@/lib/resend-config";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function deliverNotification(
  organizationId: string,
  notificationId: string,
  dependencies: { db?: Firestore; resend?: ReturnType<typeof getResendClient> } = {},
) {
  const db = dependencies.db ?? getAdminDb();
  const reference = db.doc(`organizations/${organizationId}/notifications/${notificationId}`);
  const snapshot = await reference.get();
  if (!snapshot.exists) return { ok: false as const, code: "not_found" };
  const notification = notificationSchema.parse({ id: snapshot.id, ...snapshot.data() });
  if (notification.status === "sent") return { ok: true as const, alreadySent: true };

  const environment = parseResendEnvironment(process.env);
  await reference.update({ status: "processing", attemptCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  const { data, error } = await (dependencies.resend ?? getResendClient()).emails.send({
    from: environment.fromEmail,
    to: [notification.recipientEmail],
    subject: `You’re invited to ${notification.templateData.organizationName}`,
    html: `<p>${escapeHtml(notification.templateData.inviterName)} invited you to join ${escapeHtml(notification.templateData.organizationName)} in Time Log.</p><p><a href="${escapeHtml(notification.templateData.acceptUrl)}">Accept invitation</a></p>`,
  }, { idempotencyKey: notification.idempotencyKey });

  if (error || !data?.id) {
    await executeAuditedCommand({
      db, organizationId, projectId: null, actor: { type: "system", id: "resend-outbox", role: null },
      action: "notification.email.failed", target: { type: "notification", id: notificationId }, correlation: createRequestCorrelation(),
      changes: [{ field: "deliveryStatus", to: "failed" }],
      execute: async (transaction) => { transaction.update(reference, { status: "failed", lastErrorCode: "provider_error", updatedAt: FieldValue.serverTimestamp() }); },
    });
    return { ok: false as const, code: "provider_error" };
  }
  await executeAuditedCommand({
    db, organizationId, projectId: null, actor: { type: "system", id: "resend-outbox", role: null },
    action: "notification.email.sent", target: { type: "notification", id: notificationId }, correlation: createRequestCorrelation(),
    changes: [{ field: "deliveryStatus", to: "sent" }],
    execute: async (transaction) => { transaction.update(reference, { status: "sent", providerMessageId: data.id, lastErrorCode: null, updatedAt: FieldValue.serverTimestamp() }); },
  });
  return { ok: true as const, alreadySent: false };
}
