import type { Firestore, Transaction } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AuditPersistenceError,
  AuditedCommandError,
  executeAuditedCommand,
  type AuditWriter,
} from "@/domain/audit/command";
import type { AuditEventDraft } from "@/domain/audit/schemas";

const transaction = {} as Transaction;

function fakeDb() {
  return {
    runTransaction: vi.fn(async (operation: (value: Transaction) => Promise<unknown>) => operation(transaction)),
  } as unknown as Firestore;
}

function fakeWriter() {
  const writes: AuditEventDraft[] = [];
  const transactionalWrites: AuditEventDraft[] = [];
  const writer: AuditWriter = {
    append: vi.fn(async (draft) => {
      writes.push(draft);
      return { id: "audit-failure" };
    }),
    appendInTransaction: vi.fn((_transaction, draft) => {
      transactionalWrites.push(draft);
      return { id: "audit-success" };
    }),
  };
  return { writer, writes, transactionalWrites };
}

const common = {
  organizationId: "org-1",
  projectId: "project-1",
  actor: { type: "user" as const, id: "user-1", role: "member" as const },
  action: "task.record.completed" as const,
  target: { type: "task" as const, id: "task-1" },
  correlation: { requestId: "00000000-0000-4000-8000-000000000001", runId: null },
};

describe("audited commands", () => {
  it("adds the successful audit write to the mutation transaction", async () => {
    const { writer, writes, transactionalWrites } = fakeWriter();

    await expect(executeAuditedCommand({
      ...common,
      db: fakeDb(),
      auditRepository: writer,
      changes: [{ field: "status", from: "active", to: "completed" }, { field: "title", to: "secret" }],
      execute: async (received) => {
        expect(received).toBe(transaction);
        return "done";
      },
    })).resolves.toBe("done");

    expect(writes).toHaveLength(0);
    expect(transactionalWrites).toMatchObject([{
      outcome: "succeeded",
      reasonCode: null,
      changes: [{ field: "status", from: "active", to: "completed" }],
    }]);
  });

  it("adds related lifecycle events to the same transaction", async () => {
    const { writer, transactionalWrites } = fakeWriter();
    await executeAuditedCommand({
      ...common,
      db: fakeDb(),
      auditRepository: writer,
      additionalSuccessAudits: () => [{
        action: "notification.email.queued",
        target: { type: "notification", id: "notice-1" },
        changes: [{ field: "deliveryStatus", to: "queued" }],
      }],
      execute: async () => "done",
    });
    expect(transactionalWrites.map((event) => event.action)).toEqual(["task.record.completed", "notification.email.queued"]);
  });

  it("records denied commands outside the aborted mutation transaction", async () => {
    const { writer, writes, transactionalWrites } = fakeWriter();
    const denial = new AuditedCommandError("denied", "project_access_denied", "Access denied");

    await expect(executeAuditedCommand({
      ...common,
      db: fakeDb(),
      auditRepository: writer,
      execute: async () => { throw denial; },
    })).rejects.toBe(denial);

    expect(transactionalWrites).toHaveLength(0);
    expect(writes).toMatchObject([{ outcome: "denied", reasonCode: "project_access_denied", changes: [] }]);
  });

  it("records unexpected failures without leaking their message", async () => {
    const { writer, writes } = fakeWriter();

    await expect(executeAuditedCommand({
      ...common,
      db: fakeDb(),
      auditRepository: writer,
      execute: async () => { throw new Error("database password leaked"); },
    })).rejects.toThrow("database password leaked");

    expect(writes).toMatchObject([{ outcome: "failed", reasonCode: "internal_error", changes: [] }]);
    expect(JSON.stringify(writes)).not.toContain("database password leaked");
  });

  it("fails safely when a denied or failed event cannot be persisted", async () => {
    const writer: AuditWriter = {
      append: vi.fn().mockRejectedValue(new Error("offline")),
      appendInTransaction: vi.fn(),
    };

    await expect(executeAuditedCommand({
      ...common,
      db: fakeDb(),
      auditRepository: writer,
      execute: async () => { throw new AuditedCommandError("denied", "not_allowed", "Denied"); },
    })).rejects.toBeInstanceOf(AuditPersistenceError);
  });
});
