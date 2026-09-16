import "server-only";

import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { canChangeVisibility } from "@/domain/visibility/policy";
import { changeVisibilityCommandSchema, type Visibility } from "@/domain/visibility/schemas";
import { organizationMemberSchema, projectAssignmentSchema, projectSchema } from "@/domain/organizations/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

type VisibilityTargetType = "task" | "file";
type VisibilityRecord = { id: string; visibility: Visibility };

export interface VisibilityRecordAdapter<TRecord extends VisibilityRecord = VisibilityRecord> {
  targetType: VisibilityTargetType;
  read(transaction: Transaction, recordId: string): Promise<TRecord | null>;
  update(
    transaction: Transaction,
    record: TRecord,
    values: { visibility: Visibility; updatedBy: string; updatedAt: FieldValue },
  ): void;
}

type Dependencies = { db?: Firestore; auditRepository?: AuditWriter };

export async function changeRecordVisibility<TRecord extends VisibilityRecord>(
  actor: AuthActor,
  organizationId: string,
  projectId: string,
  raw: unknown,
  correlation: AuditCorrelation,
  adapter: VisibilityRecordAdapter<TRecord>,
  dependencies: Dependencies = {},
): Promise<{ changed: boolean; previous: Visibility; visibility: Visibility }> {
  const command = changeVisibilityCommandSchema.parse(raw);
  const db = dependencies.db ?? getAdminDb();

  return executeAuditedCommand({
    db,
    auditRepository: dependencies.auditRepository,
    organizationId,
    projectId,
    actor: { type: "user", id: actor.uid, role: null },
    action: "visibility.record.changed",
    target: { type: adapter.targetType, id: command.recordId },
    correlation,
    shouldAuditSuccess: (result) => result.changed,
    changes: (result) => result.changed ? [{ field: "visibility", from: result.previous, to: result.visibility }] : [],
    execute: async (transaction) => {
      const [membershipSnapshot, assignmentSnapshot, projectSnapshot] = await Promise.all([
        transaction.get(db.doc(`organizations/${organizationId}/members/${actor.uid}`)),
        transaction.get(db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${actor.uid}`)),
        transaction.get(db.doc(`organizations/${organizationId}/projects/${projectId}`)),
      ]);
      const member = membershipSnapshot.exists
        ? organizationMemberSchema.parse(membershipSnapshot.data())
        : null;
      const assignment = assignmentSnapshot.exists
        ? projectAssignmentSchema.parse(assignmentSnapshot.data())
        : null;
      if (!canChangeVisibility(member, assignment)) {
        throw new AuditedCommandError("denied", "visibility_change_denied", "Visibility change denied");
      }
      if (!projectSnapshot.exists) {
        throw new AuditedCommandError("failed", "project_not_found", "Project not found");
      }
      const project = projectSchema.parse({ id: projectSnapshot.id, ...projectSnapshot.data() });
      if (project.status !== "active") {
        throw new AuditedCommandError("denied", "project_read_only", "Restore the project before changing visibility");
      }
      const record = await adapter.read(transaction, command.recordId);
      if (!record) throw new AuditedCommandError("failed", "record_not_found", "Record not found");
      if (record.visibility === command.visibility) {
        return { changed: false, previous: record.visibility, visibility: record.visibility };
      }
      adapter.update(transaction, record, {
        visibility: command.visibility,
        updatedBy: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { changed: true, previous: record.visibility, visibility: command.visibility };
    },
  });
}
