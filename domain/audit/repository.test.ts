import type { Firestore, Transaction } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AuditRepository } from "@/domain/audit/repository";
import { AUDIT_SCHEMA_VERSION, type AuditEventDraft } from "@/domain/audit/schemas";

const draft: AuditEventDraft = {
  organizationId: "org-1",
  projectId: null,
  actor: { type: "system", id: "cron", role: null },
  action: "notification.email.failed",
  target: { type: "notification", id: "notification-1" },
  outcome: "failed",
  changes: [{ field: "deliveryStatus", to: "failed" }],
  reasonCode: "provider_error",
  requestId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
  ipHash: null,
  userAgentSummary: null,
  schemaVersion: AUDIT_SCHEMA_VERSION,
};

function fakeFirestore() {
  const create = vi.fn().mockResolvedValue(undefined);
  const document = { id: "audit-1", create };
  const doc = vi.fn(() => document);
  const collection = vi.fn(() => ({ doc }));
  return { db: { collection } as unknown as Firestore, collection, doc, create };
}

describe("audit repository", () => {
  it("creates a standalone event under the organization audit collection", async () => {
    const fake = fakeFirestore();
    const repository = new AuditRepository(fake.db);

    await expect(repository.append(draft)).resolves.toEqual({ id: "audit-1" });

    expect(fake.collection).toHaveBeenCalledWith("organizations/org-1/auditEvents");
    expect(fake.create).toHaveBeenCalledWith(expect.objectContaining({
      id: "audit-1",
      action: "notification.email.failed",
      occurredAt: expect.anything(),
    }));
  });

  it("uses transaction.create for atomic mutation audit writes", () => {
    const fake = fakeFirestore();
    const repository = new AuditRepository(fake.db);
    const create = vi.fn();
    const transaction = { create } as unknown as Transaction;

    expect(repository.appendInTransaction(transaction, draft)).toEqual({ id: "audit-1" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: "audit-1" }),
      expect.objectContaining({ action: "notification.email.failed" }),
    );
  });

  it("does not expose update or delete operations", () => {
    const repository = new AuditRepository(fakeFirestore().db);
    expect(repository).not.toHaveProperty("update");
    expect(repository).not.toHaveProperty("delete");
  });
});

