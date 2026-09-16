import type { OrganizationMember, ProjectAssignment } from "@/domain/organizations/schemas";

export type Capability =
  | "organization.manage"
  | "members.manage"
  | "projects.manage"
  | "project.read"
  | "internal-content.read"
  | "client-visible-content.read"
  | "tasks.manage"
  | "time.track";

const ROLE_CAPABILITIES: Record<OrganizationMember["role"], ReadonlySet<Capability>> = {
  admin: new Set(["organization.manage", "members.manage", "projects.manage", "project.read", "internal-content.read", "client-visible-content.read", "tasks.manage", "time.track"]),
  member: new Set(["project.read", "internal-content.read", "client-visible-content.read", "tasks.manage", "time.track"]),
  client: new Set(["project.read", "client-visible-content.read"]),
};

export function hasCapability(member: OrganizationMember | null, capability: Capability): boolean {
  return member?.status === "active" && ROLE_CAPABILITIES[member.role].has(capability);
}

export function canAccessProject(
  member: OrganizationMember | null,
  assignment: ProjectAssignment | null,
): boolean {
  if (!hasCapability(member, "project.read")) return false;
  if (member?.role === "admin") return true;
  return assignment?.userId === member?.userId && assignment?.status === "active";
}

export function canReadVisibility(
  member: OrganizationMember | null,
  visibility: "internal" | "client-visible",
): boolean {
  return visibility === "internal"
    ? hasCapability(member, "internal-content.read")
    : hasCapability(member, "client-visible-content.read");
}
