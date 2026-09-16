import { describe, expect, it } from "vitest";

import { AUDIT_ACTIONS, AUDIT_CHANGE_ALLOWLIST } from "@/domain/audit/actions";
import { AUDIT_SCHEMA_VERSION, auditEventDraftSchema } from "@/domain/audit/schemas";

const baseEvent = {
  organizationId: "org-1",
  projectId: "project-1",
  actor: { type: "user" as const, id: "user-1", role: "admin" as const },
  action: "visibility.record.changed" as const,
  target: { type: "task" as const, id: "task-1" },
  outcome: "succeeded" as const,
  changes: [{ field: "visibility" as const, from: "internal", to: "client-visible" }],
  reasonCode: null,
  requestId: "00000000-0000-4000-8000-000000000001",
  runId: null,
  ipHash: null,
  userAgentSummary: null,
  schemaVersion: AUDIT_SCHEMA_VERSION,
};

describe("audit schema", () => {
  it("accepts a versioned event with an allowed safe change", () => {
    expect(auditEventDraftSchema.parse(baseEvent)).toEqual(baseEvent);
  });

  it("rejects fields not allowed for the action", () => {
    expect(() => auditEventDraftSchema.parse({
      ...baseEvent,
      changes: [{ field: "role", from: "member", to: "admin" }],
    })).toThrow();
  });

  it("rejects unsafe values even for an allowed field", () => {
    expect(() => auditEventDraftSchema.parse({
      ...baseEvent,
      changes: [{ field: "visibility", from: "customer secret", to: "client-visible" }],
    })).toThrow();
  });

  it("uses canonical names and defines an allowlist for every required category", () => {
    expect(AUDIT_ACTIONS.every((action) => /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$/.test(action))).toBe(true);
    expect(Object.keys(AUDIT_CHANGE_ALLOWLIST)).toEqual([...AUDIT_ACTIONS]);

    for (const category of ["auth", "organization", "project", "visibility", "task", "time", "file", "notification", "approval", "connector", "agent"]) {
      expect(AUDIT_ACTIONS.some((action) => action.startsWith(`${category}.`))).toBe(true);
    }
  });
});

