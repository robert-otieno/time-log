import { describe, expect, it } from "vitest";
import { canAccessProject, canManageProject, canReadVisibility, hasCapability } from "@/domain/organizations/policy";
import type { OrganizationMember, ProjectAssignment } from "@/domain/organizations/schemas";

const timestamp = { seconds: 1, nanoseconds: 0 };
const member = (role: OrganizationMember["role"], status: OrganizationMember["status"] = "active"): OrganizationMember => ({
  userId: `${role}-user`, role, status, clientId: role === "client" ? "client-1" : null,
  joinedAt: status === "active" ? timestamp : null,
});
const assignment = (userId: string, projectRole: ProjectAssignment["projectRole"] = "member"): ProjectAssignment => ({ userId, projectRole, status: "active", assignedBy: "admin-user", assignedAt: timestamp, removedAt: null });

describe("organization policy", () => {
  it("allows active admins to manage the organization and all projects", () => {
    expect(hasCapability(member("admin"), "members.manage")).toBe(true);
    expect(canAccessProject(member("admin"), null)).toBe(true);
  });
  it("requires explicit assignment for standard members and clients", () => {
    expect(canAccessProject(member("member"), null)).toBe(false);
    expect(canAccessProject(member("member"), assignment("member-user"))).toBe(true);
    expect(canAccessProject(member("client"), assignment("client-user"))).toBe(true);
  });
  it("limits project administrators to administrative assignments", () => {
    expect(canManageProject(member("member"), assignment("member-user", "admin"))).toBe(true);
    expect(canManageProject(member("member"), assignment("member-user"))).toBe(false);
    expect(canManageProject(member("admin"), null)).toBe(true);
  });
  it("denies suspended users and internal content to clients", () => {
    expect(canAccessProject(member("member", "suspended"), assignment("member-user"))).toBe(false);
    expect(canReadVisibility(member("client"), "internal")).toBe(false);
    expect(canReadVisibility(member("client"), "client-visible")).toBe(true);
  });
});
