import type { z } from "zod";
import type { OrganizationMember, ProjectAssignment } from "@/domain/organizations/schemas";
import { canReadVisibleRecord, type VisibleRecord } from "@/domain/visibility/policy";

export function serializeVisibleRecordForClient<TRecord extends VisibleRecord, TSchema extends z.ZodType>(
  record: TRecord,
  member: OrganizationMember | null,
  assignment: ProjectAssignment | null,
  clientSafeSchema: TSchema,
): z.output<TSchema> | null {
  if (member?.role !== "client" || !canReadVisibleRecord(member, assignment, record.visibility)) return null;
  return clientSafeSchema.parse(record);
}

