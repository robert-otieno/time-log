import type { Firestore, Transaction } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { AuditWriter } from "@/domain/audit/command";
import type { AuditEventDraft } from "@/domain/audit/schemas";
import {
  ensurePersonalOrganization,
  OrganizationBootstrapConflictError,
  personalOrganizationId,
  personalOrganizationName,
} from "@/domain/organizations/bootstrap";

const timestamp = { seconds: 1, nanoseconds: 0 };
const actor = {
  type: "user" as const,
  uid: "firebase-user-1",
  email: "person@example.com",
  emailVerified: true,
  displayName: "Casey",
};
const correlation = {
  requestId: "00000000-0000-4000-8000-000000000001",
  runId: null,
};

interface StoredDocument {
  id: string;
  data: Record<string, unknown>;
}

function bootstrapState(overrides: Record<string, StoredDocument> = {}): Record<string, StoredDocument> {
  const organizationId = personalOrganizationId(actor.uid);
  return {
    [`organizations/${organizationId}`]: {
      id: organizationId,
      data: {
        kind: "personal",
        name: "Casey’s workspace",
        slug: organizationId,
        timezone: "UTC",
        ownerId: actor.uid,
        onboardingState: "not_started",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    [`organizations/${organizationId}/members/${actor.uid}`]: {
      id: actor.uid,
      data: { userId: actor.uid, role: "admin", status: "active", clientId: null, joinedAt: timestamp },
    },
    [`users/${actor.uid}/preferences/workspace`]: {
      id: "workspace",
      data: { activeOrganizationId: organizationId, source: "bootstrap", updatedAt: timestamp },
    },
    [`organizations/${organizationId}/migrations/legacy-user-v1`]: {
      id: "legacy-user-v1",
      data: {
        organizationId,
        sourceUserId: actor.uid,
        sourcePath: `users/${actor.uid}`,
        status: "pending",
        schemaVersion: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    ...overrides,
  };
}

function fakeEnvironment(initial: Record<string, StoredDocument> = {}) {
  const creates: Array<{ path: string; data: Record<string, unknown> }> = [];
  const transaction = {
    get: vi.fn(async (reference: { path: string; id: string }) => {
      const stored = initial[reference.path];
      return {
        exists: Boolean(stored),
        id: reference.id,
        data: () => stored?.data,
      };
    }),
    create: vi.fn((reference: { path: string }, data: Record<string, unknown>) => {
      creates.push({ path: reference.path, data });
      return transaction;
    }),
  };
  const db = {
    doc: vi.fn((path: string) => ({ path, id: path.split("/").at(-1) })) as unknown as Firestore["doc"],
    runTransaction: vi.fn(async (operation: (value: Transaction) => Promise<unknown>) => operation(transaction as unknown as Transaction)),
  } as unknown as Firestore;
  const standaloneAudits: AuditEventDraft[] = [];
  const transactionalAudits: AuditEventDraft[] = [];
  const auditRepository: AuditWriter = {
    append: vi.fn(async (draft) => {
      standaloneAudits.push(draft);
      return { id: "audit-failure" };
    }),
    appendInTransaction: vi.fn((_transaction, draft) => {
      transactionalAudits.push(draft);
      return { id: "audit-success" };
    }),
  };
  return { db, transaction, creates, auditRepository, standaloneAudits, transactionalAudits };
}

describe("personal organization bootstrap", () => {
  it("derives stable safe identifiers and bounded display names", () => {
    expect(personalOrganizationId(actor.uid)).toMatch(/^personal-[a-f0-9]{32}$/);
    expect(personalOrganizationId(actor.uid)).toBe(personalOrganizationId(actor.uid));
    expect(personalOrganizationName(null)).toBe("My workspace");
    expect(personalOrganizationName(` ${"A".repeat(200)} `)).toHaveLength(120);
  });

  it("creates the organization, membership, selection, migration marker, and audit atomically", async () => {
    const environment = fakeEnvironment();

    const result = await ensurePersonalOrganization(actor, correlation, environment);

    expect(result.created).toEqual({ organization: true, membership: true, selection: true, migrationMarker: true });
    expect(environment.creates.map((write) => write.path)).toEqual(expect.arrayContaining([
      `organizations/${result.organizationId}`,
      `organizations/${result.organizationId}/members/${actor.uid}`,
      `users/${actor.uid}/preferences/workspace`,
      `organizations/${result.organizationId}/migrations/legacy-user-v1`,
    ]));
    expect(environment.transactionalAudits).toMatchObject([{
      action: "organization.bootstrap.completed",
      outcome: "succeeded",
      target: { type: "organization", id: result.organizationId },
      changes: [
        { field: "organizationCreated", to: true },
        { field: "membershipCreated", to: true },
        { field: "selectionCreated", to: true },
        { field: "migrationMarkerCreated", to: true },
      ],
    }]);
  });

  it("is a no-op on retry and does not create duplicate audit noise", async () => {
    const environment = fakeEnvironment(bootstrapState());

    const result = await ensurePersonalOrganization(actor, correlation, environment);

    expect(Object.values(result.created).some(Boolean)).toBe(false);
    expect(environment.creates).toHaveLength(0);
    expect(environment.transactionalAudits).toHaveLength(0);
    expect(environment.standaloneAudits).toHaveLength(0);
  });

  it("repairs missing records while preserving an existing selection", async () => {
    const state = bootstrapState();
    const organizationId = personalOrganizationId(actor.uid);
    delete state[`organizations/${organizationId}/migrations/legacy-user-v1`];
    state[`users/${actor.uid}/preferences/workspace`] = {
      id: "workspace",
      data: { activeOrganizationId: "another-org", source: "user", updatedAt: timestamp },
    };
    const environment = fakeEnvironment(state);

    const result = await ensurePersonalOrganization(actor, correlation, environment);

    expect(result.created).toEqual({ organization: false, membership: false, selection: false, migrationMarker: true });
    expect(environment.creates).toHaveLength(1);
    expect(environment.creates[0].path).toBe(`organizations/${organizationId}/migrations/legacy-user-v1`);
  });

  it("fails safely and audits conflicting ownership without overwriting it", async () => {
    const state = bootstrapState();
    const organizationId = personalOrganizationId(actor.uid);
    state[`organizations/${organizationId}`]!.data.ownerId = "another-user";
    const environment = fakeEnvironment(state);

    await expect(ensurePersonalOrganization(actor, correlation, environment))
      .rejects.toBeInstanceOf(OrganizationBootstrapConflictError);

    expect(environment.creates).toHaveLength(0);
    expect(environment.transactionalAudits).toHaveLength(0);
    expect(environment.standaloneAudits).toMatchObject([{
      outcome: "failed",
      reasonCode: "organization_owner_conflict",
      changes: [],
    }]);
  });
});
