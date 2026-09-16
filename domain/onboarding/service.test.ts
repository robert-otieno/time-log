import type { Firestore, Transaction } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import type { AuditWriter } from "@/domain/audit/command";
import type { AuditEventDraft } from "@/domain/audit/schemas";
import { personalOrganizationId } from "@/domain/organizations/bootstrap";
import { ONBOARDING_PROJECT_ID, saveOnboardingStep } from "@/domain/onboarding/service";

const actor = { type: "user" as const, uid: "u1", email: null, emailVerified: true, displayName: "Casey" };
const correlation = { requestId: "00000000-0000-4000-8000-000000000001", runId: null };
const timestamp = { seconds: 1, nanoseconds: 0 };
const organizationId = personalOrganizationId(actor.uid);
const organization = { kind: "personal", name: "Workspace", slug: organizationId, timezone: "UTC", ownerId: actor.uid, onboardingState: "not_started", createdAt: timestamp, updatedAt: timestamp };
const membership = { userId: actor.uid, role: "admin", status: "active", clientId: null, joinedAt: timestamp };

function environment(extra: Record<string, Record<string, unknown>> = {}) {
  const records: Record<string, Record<string, unknown>> = {
    [`organizations/${organizationId}`]: organization,
    [`organizations/${organizationId}/members/${actor.uid}`]: membership,
    ...extra,
  };
  const writes: Array<{ method: string; path: string; data: Record<string, unknown> }> = [];
  const transaction = {
    get: vi.fn(async (ref: { path: string; id: string }) => ({ exists: Boolean(records[ref.path]), id: ref.id, data: () => records[ref.path] })),
    set: vi.fn((ref: { path: string }, data: Record<string, unknown>) => { writes.push({ method: "set", path: ref.path, data }); return transaction; }),
    update: vi.fn((ref: { path: string }, data: Record<string, unknown>) => { writes.push({ method: "update", path: ref.path, data }); return transaction; }),
  };
  const db = {
    doc: vi.fn((path: string) => ({ path, id: path.split("/").at(-1) })),
    runTransaction: vi.fn(async (callback: (transaction: Transaction) => Promise<unknown>) => callback(transaction as unknown as Transaction)),
  } as unknown as Firestore;
  const audits: AuditEventDraft[] = [];
  const auditRepository: AuditWriter = {
    append: vi.fn(async (draft) => { audits.push(draft); return { id: "a-fail" }; }),
    appendInTransaction: vi.fn((_transaction, draft) => { audits.push(draft); return { id: "a-ok" }; }),
  };
  return { db, auditRepository, writes, audits };
}

const profileCommand = {
  step: "profile" as const, displayName: "Casey", timezone: "UTC",
  workingHours: { days: ["mon" as const, "tue" as const], start: "09:00", end: "17:00" },
  emailPreferences: { assignments: true, mentions: true, reminders: true, digest: true },
};

describe("onboarding service", () => {
  it("persists the first profile step and an atomic audit", async () => {
    const env = environment();
    await expect(saveOnboardingStep(actor, profileCommand, correlation, env)).resolves.toMatchObject({ currentStep: "organization" });
    expect(env.writes).toContainEqual(expect.objectContaining({ method: "set", path: `organizations/${organizationId}/onboarding/${actor.uid}` }));
    expect(env.audits).toMatchObject([{ action: "organization.onboarding.profile.saved", outcome: "succeeded" }]);
  });

  it("rejects steps attempted out of order and audits the denial", async () => {
    const env = environment();
    await expect(saveOnboardingStep(actor, { step: "project", name: "First" }, correlation, env)).rejects.toThrow("earlier onboarding steps");
    expect(env.audits).toMatchObject([{ outcome: "denied", reasonCode: "onboarding_step_out_of_order" }]);
  });

  it("creates the deterministic first project once", async () => {
    const state = { schemaVersion: 1, userId: actor.uid, currentStep: "project", completedSteps: ["profile", "organization"], profile: { ...profileCommand, step: undefined }, firstProjectId: null, updatedAt: timestamp, completedAt: null };
    delete (state.profile as Record<string, unknown>).step;
    const env = environment({ [`organizations/${organizationId}/onboarding/${actor.uid}`]: state });
    const result = await saveOnboardingStep(actor, { step: "project", name: "My first project" }, correlation, env);
    expect(result).toEqual({ currentStep: "education", projectCreated: true });
    expect(env.writes).toContainEqual(expect.objectContaining({ path: `organizations/${organizationId}/projects/${ONBOARDING_PROJECT_ID}`, data: expect.objectContaining({ key: "FIRST", enabledTools: ["todos", "time"], defaultVisibility: "internal" }) }));
  });

  it("completes onboarding only after prior steps and acknowledgement", async () => {
    const profile = { displayName: "Casey", timezone: "UTC", workingHours: profileCommand.workingHours, emailPreferences: profileCommand.emailPreferences };
    const state = { schemaVersion: 1, userId: actor.uid, currentStep: "education", completedSteps: ["profile", "organization", "project"], profile, firstProjectId: ONBOARDING_PROJECT_ID, updatedAt: timestamp, completedAt: null };
    const env = environment({ [`organizations/${organizationId}/onboarding/${actor.uid}`]: state });
    await expect(saveOnboardingStep(actor, { step: "education", acknowledged: true }, correlation, env)).resolves.toMatchObject({ currentStep: "complete" });
    expect(env.writes).toContainEqual(expect.objectContaining({ method: "update", path: `organizations/${organizationId}`, data: expect.objectContaining({ onboardingState: "complete", timezone: "UTC" }) }));
  });
});

