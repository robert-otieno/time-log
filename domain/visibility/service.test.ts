import type { Firestore, Transaction } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import type { AuditWriter } from "@/domain/audit/command";
import type { AuditEventDraft } from "@/domain/audit/schemas";
import { changeRecordVisibility, type VisibilityRecordAdapter } from "@/domain/visibility/service";

const actor = { type: "user" as const, uid: "u1", email: null, emailVerified: true, displayName: "Casey" };
const correlation = { requestId: "00000000-0000-4000-8000-000000000001", runId: null };
const timestamp = { seconds: 1, nanoseconds: 0 };
const organizationId = "org-1";
const projectId = "project-1";
const project = { id: projectId, name: "Site", key: "SITE", description: null, clientId: null, status: "active", enabledTools: ["todos"], defaultVisibility: "internal", templateSource: null, createdBy: "u1", createdAt: timestamp, updatedBy: "u1", updatedAt: timestamp };

function environment(role: "admin" | "member" | "client" = "member", recordVisibility: "internal" | "client-visible" = "internal") {
  const membership = { userId: actor.uid, role, status: "active", clientId: role === "client" ? "c1" : null, joinedAt: timestamp };
  const assignment = { userId: actor.uid, status: "active", assignedBy: "admin", assignedAt: timestamp, removedAt: null };
  const records: Record<string, Record<string, unknown>> = {
    [`organizations/${organizationId}/members/${actor.uid}`]: membership,
    [`organizations/${organizationId}/projects/${projectId}`]: project,
    [`organizations/${organizationId}/projects/${projectId}/projectMembers/${actor.uid}`]: assignment,
  };
  const updates: unknown[] = [];
  const transaction = { get: vi.fn(async (ref: { path: string; id: string }) => ({ exists: Boolean(records[ref.path]), id: ref.id, data: () => records[ref.path] })) };
  const db = {
    doc: vi.fn((path: string) => ({ path, id: path.split("/").at(-1) })),
    runTransaction: vi.fn(async (callback: (value: Transaction) => Promise<unknown>) => callback(transaction as unknown as Transaction)),
  } as unknown as Firestore;
  const audits: AuditEventDraft[] = [];
  const auditRepository: AuditWriter = {
    append: vi.fn(async (draft) => { audits.push(draft); return { id: "failed" }; }),
    appendInTransaction: vi.fn((_transaction, draft) => { audits.push(draft); return { id: "success" }; }),
  };
  const adapter: VisibilityRecordAdapter = {
    targetType: "task",
    read: vi.fn(async (_transaction, id) => id === "task-1" ? { id, visibility: recordVisibility } : null),
    update: vi.fn((_transaction, record, values) => updates.push({ record, values })),
  };
  return { db, auditRepository, adapter, audits, updates, records };
}

describe("visibility change service", () => {
  it("updates through the adapter and writes an atomic redacted audit", async () => {
    const env = environment();
    await expect(changeRecordVisibility(actor, organizationId, projectId, { recordId: "task-1", visibility: "client-visible" }, correlation, env.adapter, env)).resolves.toEqual({ changed: true, visibility: "client-visible", previous: "internal" });
    expect(env.updates).toHaveLength(1);
    expect(env.audits).toMatchObject([{ action: "visibility.record.changed", outcome: "succeeded", changes: [{ field: "visibility", from: "internal", to: "client-visible" }] }]);
  });

  it("does not write or audit an unchanged value", async () => {
    const env = environment("member", "client-visible");
    await expect(changeRecordVisibility(actor, organizationId, projectId, { recordId: "task-1", visibility: "client-visible" }, correlation, env.adapter, env)).resolves.toMatchObject({ changed: false });
    expect(env.updates).toHaveLength(0);
    expect(env.audits).toHaveLength(0);
  });

  it("denies clients and persists the denied attempt", async () => {
    const env = environment("client");
    await expect(changeRecordVisibility(actor, organizationId, projectId, { recordId: "task-1", visibility: "client-visible" }, correlation, env.adapter, env)).rejects.toThrow("Visibility change denied");
    expect(env.updates).toHaveLength(0);
    expect(env.audits).toMatchObject([{ outcome: "denied", reasonCode: "visibility_change_denied" }]);
  });

  it("rejects unknown records and audits a safe failure", async () => {
    const env = environment();
    await expect(changeRecordVisibility(actor, organizationId, projectId, { recordId: "missing", visibility: "client-visible" }, correlation, env.adapter, env)).rejects.toThrow("Record not found");
    expect(env.audits).toMatchObject([{ outcome: "failed", reasonCode: "record_not_found", changes: [] }]);
  });
});

