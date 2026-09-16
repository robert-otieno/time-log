import { describe, expect, it } from "vitest";
import type { OrganizationMember, ProjectAssignment } from "@/domain/organizations/schemas";
import { canChangeVisibility, canReadVisibleRecord, filterVisibleRecords, visibilityForQuery } from "@/domain/visibility/policy";

const timestamp = { seconds: 1, nanoseconds: 0 };
const assignment: ProjectAssignment = { userId: "u1", status: "active", assignedBy: "admin", assignedAt: timestamp, removedAt: null };
const member = (role: OrganizationMember["role"], status: OrganizationMember["status"] = "active"): OrganizationMember => ({
  userId: "u1", role, status, clientId: role === "client" ? "c1" : null, joinedAt: status === "active" ? timestamp : null,
});

describe("visibility policy", () => {
  it("requires active project access independently of record visibility", () => {
    expect(canReadVisibleRecord(member("client"), assignment, "client-visible")).toBe(true);
    expect(canReadVisibleRecord(member("client"), null, "client-visible")).toBe(false);
    expect(canReadVisibleRecord(member("client", "suspended"), assignment, "client-visible")).toBe(false);
  });

  it("never exposes internal records to clients", () => {
    const records = [{ id: "internal", visibility: "internal" as const }, { id: "shared", visibility: "client-visible" as const }];
    expect(filterVisibleRecords(records, member("client"), assignment)).toEqual([records[1]]);
    expect(filterVisibleRecords(records, member("member"), assignment)).toEqual(records);
  });

  it("allows assigned internal users to change visibility but denies clients", () => {
    expect(canChangeVisibility(member("admin"), null)).toBe(true);
    expect(canChangeVisibility(member("member"), assignment)).toBe(true);
    expect(canChangeVisibility(member("member"), null)).toBe(false);
    expect(canChangeVisibility(member("client"), assignment)).toBe(false);
  });

  it("requires client queries to constrain visibility at the database", () => {
    expect(visibilityForQuery(member("client"))).toEqual({ kind: "visibility", visibility: "client-visible" });
    expect(visibilityForQuery(member("member"))).toEqual({ kind: "all" });
    expect(visibilityForQuery(member("member", "suspended"))).toEqual({ kind: "deny" });
  });
});
