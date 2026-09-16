import { describe, expect, it } from "vitest";
import { organizationMemberSchema, projectAssignmentSchema } from "@/domain/organizations/schemas";

const timestamp = { seconds: 1, nanoseconds: 0 };

describe("organization schemas", () => {
  it("requires client memberships to reference a client", () => {
    expect(organizationMemberSchema.safeParse({ userId: "u1", role: "client", status: "active", clientId: null, joinedAt: timestamp }).success).toBe(false);
  });
  it("rejects client links on internal memberships", () => {
    expect(organizationMemberSchema.safeParse({ userId: "u1", role: "member", status: "active", clientId: "c1", joinedAt: timestamp }).success).toBe(false);
  });
  it("requires removed assignments to record when removal occurred", () => {
    expect(projectAssignmentSchema.safeParse({ userId: "u1", status: "removed", assignedBy: "a1", assignedAt: timestamp, removedAt: null }).success).toBe(false);
  });
  it("accepts removed memberships while preserving identity", () => {
    expect(organizationMemberSchema.safeParse({ userId: "u1", role: "member", status: "removed", clientId: null, joinedAt: timestamp }).success).toBe(true);
  });
});
