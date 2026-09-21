import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { OrganizationMember, ProjectAssignment } from "@/domain/organizations/schemas";
import { serializeVisibleRecordForClient } from "@/domain/visibility/serialization";

const timestamp = { seconds: 1, nanoseconds: 0 };
const client: OrganizationMember = { userId: "client", email: "client@example.com", role: "client", status: "active", clientId: "c1", joinedAt: timestamp };
const assignment: ProjectAssignment = { userId: "client", projectRole: "member", status: "active", assignedBy: "admin", assignedAt: timestamp, removedAt: null };
const safeSchema = z.object({ id: z.string(), title: z.string() }).strip();

describe("client-safe visibility serialization", () => {
  it("uses an explicit schema to remove internal fields", () => {
    const serialized = serializeVisibleRecordForClient({ id: "t1", title: "Status", visibility: "client-visible" as const, internalNotes: "secret", createdBy: "u1" }, client, assignment, safeSchema);
    expect(serialized).toEqual({ id: "t1", title: "Status" });
    expect(JSON.stringify(serialized)).not.toContain("secret");
  });

  it("returns null for internal records, missing assignment, and non-client callers", () => {
    expect(serializeVisibleRecordForClient({ id: "t1", title: "Hidden", visibility: "internal" as const }, client, assignment, safeSchema)).toBeNull();
    expect(serializeVisibleRecordForClient({ id: "t1", title: "Shared", visibility: "client-visible" as const }, client, null, safeSchema)).toBeNull();
    expect(serializeVisibleRecordForClient({ id: "t1", title: "Shared", visibility: "client-visible" as const }, { ...client, role: "member", clientId: null }, assignment, safeSchema)).toBeNull();
  });
});
