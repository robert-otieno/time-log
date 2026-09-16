import type { OrganizationMember, ProjectAssignment } from "@/domain/organizations/schemas";
import { canAccessProject, canReadVisibility } from "@/domain/organizations/policy";
import type { Visibility } from "@/domain/visibility/schemas";

export type VisibleRecord = { visibility: Visibility };
export type VisibilityQueryScope =
  | { kind: "deny" }
  | { kind: "all" }
  | { kind: "visibility"; visibility: "client-visible" };

export function canReadVisibleRecord(
  member: OrganizationMember | null,
  assignment: ProjectAssignment | null,
  visibility: Visibility,
): boolean {
  return canAccessProject(member, assignment) && canReadVisibility(member, visibility);
}

export function canChangeVisibility(
  member: OrganizationMember | null,
  assignment: ProjectAssignment | null,
): boolean {
  return member?.role !== "client"
    && canAccessProject(member, assignment)
    && (member?.role === "admin" || member?.role === "member");
}

export function visibilityForQuery(member: OrganizationMember | null): VisibilityQueryScope {
  if (!member || member.status !== "active") return { kind: "deny" };
  return member.role === "client"
    ? { kind: "visibility", visibility: "client-visible" }
    : { kind: "all" };
}

export function filterVisibleRecords<T extends VisibleRecord>(
  records: readonly T[],
  member: OrganizationMember | null,
  assignment: ProjectAssignment | null,
): T[] {
  return records.filter((record) => canReadVisibleRecord(member, assignment, record.visibility));
}
