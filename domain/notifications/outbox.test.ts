import type { Firestore, Transaction } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/domain/audit/command", () => ({ executeAuditedCommand: async (options: { db: Firestore; execute(transaction: Transaction): Promise<unknown> }) => options.db.runTransaction(options.execute) }));
vi.mock("@/domain/audit/correlation", () => ({ createRequestCorrelation: () => ({ requestId: "00000000-0000-4000-8000-000000000001", runId: null }) }));

import { deliverNotification } from "@/domain/notifications/outbox";

const timestamp = { seconds: 1, nanoseconds: 0 };
const notification = { type: "invitation", recipientEmail: "person@example.com", recipientUserId: null, templateData: { organizationName: "Acme", inviterName: "Casey", acceptUrl: "https://example.com/invite" }, status: "queued", idempotencyKey: "invitation/n1", providerMessageId: null, attemptCount: 0, lastErrorCode: null, claimId: null, claimExpiresAt: null, nextAttemptAt: null, createdAt: timestamp, updatedAt: timestamp };
const invitation = { email: "person@example.com", role: "member", clientId: null, tokenHash: "a".repeat(64), status: "pending", projectIds: [], expiresAt: { seconds: 2_000_000_000, nanoseconds: 0 }, acceptedBy: null, acceptedAt: null, createdBy: "u1", createdAt: timestamp, updatedAt: timestamp };

function environment(initial: Record<string, unknown> = notification) {
  const records: Record<string, Record<string, unknown>> = { "organizations/o1/notifications/n1": { ...initial }, "organizations/o1/invitations/n1": invitation };
  const reference = (path: string) => ({ path, id: path.split("/").at(-1), get: async () => snapshot(path) });
  const snapshot = (path: string) => ({ exists: Boolean(records[path]), id: path.split("/").at(-1), data: () => records[path] });
  const transaction = { get: vi.fn(async (ref: { path: string }) => snapshot(ref.path)), update: vi.fn((ref: { path: string }, values: Record<string, unknown>) => Object.assign(records[ref.path], values)) };
  const db = { doc: vi.fn(reference), runTransaction: vi.fn(async (operation: (transaction: Transaction) => Promise<unknown>) => operation(transaction as unknown as Transaction)) } as unknown as Firestore;
  return { db, records };
}

describe("notification delivery", () => {
  beforeEach(() => { process.env.RESEND_API_KEY = "re_test"; process.env.RESEND_FROM_EMAIL = "Time Log <mail@example.com>"; });

  it("claims, renders, and sends with the stored idempotency key", async () => {
    const env = environment(); const send = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });
    await expect(deliverNotification("o1", "n1", { db: env.db, resend: { emails: { send } } as never, now: () => new Date("2026-09-20T12:00:00Z"), claimId: () => "claim-1" })).resolves.toMatchObject({ ok: true, alreadySent: false });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ["person@example.com"], text: expect.any(String), html: expect.any(String) }), { idempotencyKey: "invitation/n1" });
    expect(env.records["organizations/o1/notifications/n1"]).toMatchObject({ status: "sent", providerMessageId: "email-1", claimId: null });
  });

  it("does not process an active claim", async () => {
    const env = environment({ ...notification, status: "processing", claimId: "other", claimExpiresAt: { seconds: 2_000_000_000, nanoseconds: 0 } });
    const send = vi.fn();
    await expect(deliverNotification("o1", "n1", { db: env.db, resend: { emails: { send } } as never, now: () => new Date("2026-09-20T12:00:00Z") })).resolves.toEqual({ ok: false, code: "not_claimable" });
    expect(send).not.toHaveBeenCalled();
  });

  it("suppresses an obsolete invitation before provider delivery", async () => {
    const env = environment(); env.records["organizations/o1/invitations/n1"] = { ...invitation, status: "revoked" };
    const send = vi.fn();
    await expect(deliverNotification("o1", "n1", { db: env.db, resend: { emails: { send } } as never, now: () => new Date("2026-09-20T12:00:00Z"), claimId: () => "claim-1" })).resolves.toEqual({ ok: false, code: "suppressed" });
    expect(send).not.toHaveBeenCalled();
    expect(env.records["organizations/o1/notifications/n1"]).toMatchObject({ status: "suppressed", lastErrorCode: "recipient_ineligible" });
  });

  it("turns recipient resolution errors into an audited retryable failure", async () => {
    const env = environment(); env.records["organizations/o1/invitations/n1"] = { ...invitation, tokenHash: "invalid" };
    const send = vi.fn();
    await expect(deliverNotification("o1", "n1", { db: env.db, resend: { emails: { send } } as never, now: () => new Date("2026-09-20T12:00:00Z"), claimId: () => "claim-1" })).resolves.toEqual({ ok: false, code: "recipient_resolution_error" });
    expect(send).not.toHaveBeenCalled();
    expect(env.records["organizations/o1/notifications/n1"]).toMatchObject({ status: "failed", lastErrorCode: "recipient_resolution_error", claimId: null });
  });

  it("suppresses a non-essential assignment disabled in user preferences", async () => {
    const assignmentNotice = { ...notification, type: "assignment", recipientEmail: "person@example.com", recipientUserId: "u2", projectId: "p1", taskId: "t1", idempotencyKey: "assignment/n1", templateData: { organizationName: "Acme", projectName: "Site", taskTitle: "Draft", assignedByName: "Casey", taskUrl: "https://example.com/task" } };
    const env = environment(assignmentNotice);
    env.records["organizations/o1/members/u2"] = { userId: "u2", email: "person@example.com", displayName: "Person", role: "member", status: "active", clientId: null, joinedAt: timestamp };
    env.records["organizations/o1/projects/p1/projectMembers/u2"] = { userId: "u2", status: "active", assignedBy: "u1", assignedAt: timestamp, removedAt: null };
    env.records["organizations/o1/projects/p1/tasks/t1"] = { projectId: "p1", title: "Draft", description: null, assigneeIds: ["u2"], status: "todo", priority: "medium", dueDate: null, dueAt: null, dueTimeSet: false, visibility: "internal", parentTaskId: null, boardColumnId: null, sortOrder: 0, completedAt: null, archivedAt: null, migrationSource: null, createdBy: "u1", createdAt: timestamp, updatedBy: "u1", updatedAt: timestamp };
    env.records["users/u2/preferences/notifications"] = { schemaVersion: 1, userId: "u2", timezone: "UTC", email: { assignments: false, mentions: true, reminders: true, announcements: true, digestFrequency: "weekly" }, updatedAt: timestamp };
    const send = vi.fn();
    await expect(deliverNotification("o1", "n1", { db: env.db, resend: { emails: { send } } as never, now: () => new Date("2026-09-20T12:00:00Z"), claimId: () => "claim-1" })).resolves.toEqual({ ok: false, code: "suppressed" });
    expect(send).not.toHaveBeenCalled();
  });

  it("suppresses a client announcement when the post is no longer client-visible", async () => {
    const announcement = { ...notification, type: "announcement", recipientEmail: "client@example.com", recipientUserId: "client", projectId: "p1", messageId: "m1", idempotencyKey: "announcement/m1/client", templateData: { projectName: "Site", announcementTitle: "Launch", authorName: "Casey", targetUrl: "https://example.com/messages#post-m1" } };
    const env = environment(announcement);
    env.records["organizations/o1/members/client"] = { userId: "client", email: "client@example.com", displayName: "Client", role: "client", status: "active", clientId: "c1", joinedAt: timestamp };
    env.records["organizations/o1/projects/p1/projectMembers/client"] = { userId: "client", projectRole: "member", status: "active", assignedBy: "u1", assignedAt: timestamp, removedAt: null };
    env.records["organizations/o1/projects/p1/messages/m1"] = { title: "Launch", body: "Details", authorId: "u1", authorName: "Casey", visibility: "internal", announcement: true, pinnedAt: null, pinnedBy: null, createdAt: timestamp, updatedAt: timestamp, editedAt: null, archivedAt: null };
    const send = vi.fn();
    await expect(deliverNotification("o1", "n1", { db: env.db, resend: { emails: { send } } as never, now: () => new Date("2026-09-20T12:00:00Z"), claimId: () => "claim-1" })).resolves.toEqual({ ok: false, code: "suppressed" });
    expect(send).not.toHaveBeenCalled();
  });
});
