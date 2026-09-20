import type { Firestore, Transaction } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/domain/audit/command", () => ({ executeAuditedCommand: async (options: { db: Firestore; execute(transaction: Transaction): Promise<unknown> }) => options.db.runTransaction(options.execute) }));
vi.mock("@/domain/audit/correlation", () => ({ createRequestCorrelation: () => ({ requestId: "00000000-0000-4000-8000-000000000001", runId: null }) }));
import { processResendWebhook } from "@/domain/notifications/webhook";

const timestamp = { seconds: 1, nanoseconds: 0 };
const notice = { type: "invitation", recipientEmail: "person@example.com", recipientUserId: null, templateData: { organizationName: "Acme", inviterName: "Casey", acceptUrl: "https://example.com/invite" }, status: "sent", idempotencyKey: "invitation/n1", providerMessageId: "email-1", providerStatus: "sent", providerEventAt: { seconds: 100, nanoseconds: 0 }, attemptCount: 1, lastErrorCode: null, claimId: null, claimExpiresAt: null, nextAttemptAt: null, createdAt: timestamp, updatedAt: timestamp };
const event = (type: string, created_at = "2026-09-20T12:00:00.000Z") => ({ type, created_at, data: { email_id: "email-1", to: ["person@example.com"] } });

function environment(initial = notice) {
  const notificationPath = "organizations/o1/notifications/n1"; const records: Record<string, Record<string, unknown>> = { [notificationPath]: { ...initial } };
  const snapshot = (path: string) => ({ exists: Boolean(records[path]), id: path.split("/").at(-1), data: () => records[path], ref: reference(path) });
  const reference = (path: string) => ({ path, id: path.split("/").at(-1), get: async () => snapshot(path) });
  const transaction = { get: vi.fn(async (ref: { path: string }) => snapshot(ref.path)), create: vi.fn((ref: { path: string }, data: Record<string, unknown>) => { records[ref.path] = data; }), update: vi.fn((ref: { path: string }, data: Record<string, unknown>) => Object.assign(records[ref.path], data)), set: vi.fn((ref: { path: string }, data: Record<string, unknown>) => { records[ref.path] = { ...(records[ref.path] ?? {}), ...data }; }) };
  const query = { where: () => query, limit: () => query, get: async () => ({ size: 1, empty: false, docs: [snapshot(notificationPath)] }) };
  const db = { doc: vi.fn(reference), collectionGroup: vi.fn(() => query), runTransaction: vi.fn(async (operation: (transaction: Transaction) => Promise<unknown>) => operation(transaction as unknown as Transaction)) } as unknown as Firestore;
  return { db, records, notificationPath };
}

describe("Resend webhook processing", () => {
  it("applies a newer delivery event and deduplicates its receipt", async () => {
    const env = environment();
    await expect(processResendWebhook("evt-1", event("email.delivered"), { db: env.db })).resolves.toEqual({ outcome: "applied" });
    expect(env.records[env.notificationPath]).toMatchObject({ status: "sent", providerStatus: "delivered" });
    await expect(processResendWebhook("evt-1", event("email.delivered"), { db: env.db })).resolves.toEqual({ outcome: "duplicate" });
  });
  it("records but does not apply an older event", async () => {
    const env = environment({ ...notice, providerEventAt: { seconds: 2_000_000_000, nanoseconds: 0 } });
    await expect(processResendWebhook("evt-old", event("email.bounced", "2026-09-20T12:00:00.000Z"), { db: env.db })).resolves.toEqual({ outcome: "stale" });
    expect(env.records[env.notificationPath]).toMatchObject({ status: "sent", providerStatus: "sent" });
  });
  it("creates a hashed suppression after a complaint", async () => {
    const env = environment(); await processResendWebhook("evt-2", event("email.complained"), { db: env.db });
    const suppression = Object.entries(env.records).find(([path]) => path.startsWith("emailSuppressions/"));
    expect(suppression?.[1]).toMatchObject({ reason: "complained", sourceMessageId: "email-1" });
    expect(env.records[env.notificationPath]).toMatchObject({ status: "sent", providerStatus: "complained" });
    expect(JSON.stringify(suppression)).not.toContain("person@example.com");
  });
  it("ignores engagement events without persisting them", async () => {
    const env = environment(); await expect(processResendWebhook("evt-open", event("email.opened"), { db: env.db })).resolves.toEqual({ outcome: "ignored" });
    expect(Object.keys(env.records)).toEqual([env.notificationPath]);
  });
});
