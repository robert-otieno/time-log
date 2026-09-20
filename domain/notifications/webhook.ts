import "server-only";

import { createHash } from "node:crypto";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { notificationSchema } from "@/domain/notifications/schemas";
import { getAdminDb } from "@/lib/firebase-admin";

const operationalEventSchema = z.object({
  type: z.enum(["email.sent", "email.delivered", "email.delivery_delayed", "email.bounced", "email.complained", "email.failed", "email.suppressed"]),
  created_at: z.string().datetime({ offset: true }),
  data: z.object({ email_id: z.string().min(1).max(256), to: z.array(z.string().email()).min(1).max(1) }).passthrough(),
}).passthrough();

const providerStatus = { "email.sent": "sent", "email.delivered": "delivered", "email.delivery_delayed": "delivery_delayed", "email.bounced": "bounced", "email.complained": "complained", "email.failed": "failed", "email.suppressed": "suppressed" } as const;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function processResendWebhook(eventId: string, raw: unknown, dependencies: { db?: Firestore; auditRepository?: AuditWriter } = {}) {
  const parsed = operationalEventSchema.safeParse(raw);
  if (!parsed.success) return { outcome: "ignored" as const };
  const event = parsed.data; const db = dependencies.db ?? getAdminDb(); const receiptRef = db.doc(`resendWebhookEvents/${hash(eventId)}`);
  const existingReceipt = await receiptRef.get(); if (existingReceipt.exists) return { outcome: "duplicate" as const };
  const matches = await db.collectionGroup("notifications").where("providerMessageId", "==", event.data.email_id).limit(2).get();
  if (matches.size !== 1) {
    await db.runTransaction(async (transaction) => { const receipt = await transaction.get(receiptRef); if (!receipt.exists) transaction.create(receiptRef, { eventIdHash: hash(eventId), providerMessageId: event.data.email_id, eventType: event.type, outcome: matches.empty ? "unmatched" : "ambiguous", receivedAt: FieldValue.serverTimestamp() }); });
    return { outcome: matches.empty ? "unmatched" as const : "ambiguous" as const };
  }
  const document = matches.docs[0]; const segments = document.ref.path.split("/"); const organizationId = segments[1]; const notificationId = document.id; const eventAt = Timestamp.fromDate(new Date(event.created_at)); const status = providerStatus[event.type];
  return executeAuditedCommand<{ outcome: "applied" | "stale" | "duplicate" }>({ db, auditRepository: dependencies.auditRepository, organizationId, projectId: document.data().projectId ?? null, actor: { type: "system", id: "resend-webhook", role: null }, action: "notification.delivery.updated", target: { type: "notification", id: notificationId }, correlation: createRequestCorrelation(), changes: (result) => [{ field: "webhookOutcome", to: result.outcome }], execute: async (transaction) => {
    const [receipt, notificationSnapshot] = await Promise.all([transaction.get(receiptRef), transaction.get(document.ref)]);
    if (receipt.exists) return { outcome: "duplicate" as const };
    const notification = notificationSchema.parse({ id: notificationSnapshot.id, ...notificationSnapshot.data() });
    const isNewer = !notification.providerEventAt || notification.providerEventAt.seconds * 1000 + notification.providerEventAt.nanoseconds / 1e6 < eventAt.toMillis();
    transaction.create(receiptRef, { eventIdHash: hash(eventId), providerMessageId: event.data.email_id, eventType: event.type, outcome: isNewer ? "applied" : "stale", receivedAt: FieldValue.serverTimestamp(), eventAt });
    if (!isNewer) return { outcome: "stale" as const };
    transaction.update(document.ref, { providerStatus: status, providerEventAt: eventAt, updatedAt: FieldValue.serverTimestamp() });
    if ((status === "bounced" || status === "complained") && event.data.to[0]) {
      const normalizedEmail = event.data.to[0].trim().toLowerCase(); const suppressionRef = db.doc(`emailSuppressions/${hash(normalizedEmail)}`);
      transaction.set(suppressionRef, { emailHash: hash(normalizedEmail), reason: status, sourceMessageId: event.data.email_id, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    return { outcome: "applied" as const };
  }});
}
