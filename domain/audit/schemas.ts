import { z } from "zod";

import {
  AUDIT_ACTIONS,
  AUDIT_CHANGE_ALLOWLIST,
  SAFE_AUDIT_FIELDS,
  type SafeAuditField,
} from "@/domain/audit/actions";

export const AUDIT_SCHEMA_VERSION = 1 as const;

export const auditActionSchema = z.enum(AUDIT_ACTIONS);
export const auditOutcomeSchema = z.enum(["succeeded", "denied", "failed"]);
export const auditActorTypeSchema = z.enum(["user", "system", "agent", "connector"]);
export const auditActorRoleSchema = z.enum(["admin", "member", "client"]);
export const auditTargetTypeSchema = z.enum([
  "session",
  "organization",
  "membership",
  "invitation",
  "client",
  "project",
  "task",
  "migration",
  "timer",
  "time-entry",
  "file",
  "message",
  "comment",
  "notification",
  "approval",
  "connector",
  "agent-run",
  "preference",
  "job-run",
]);

const timestampSchema = z.custom<{ seconds: number; nanoseconds: number }>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    "nanoseconds" in value,
  "Expected a Firestore timestamp",
);

export const auditActorSchema = z.object({
  type: auditActorTypeSchema,
  id: z.string().trim().min(1).max(128),
  role: auditActorRoleSchema.nullable(),
}).strict();

export const auditTargetSchema = z.object({
  type: auditTargetTypeSchema,
  id: z.string().trim().min(1).max(256).nullable(),
}).strict();

export const safeAuditValueSchema = z.union([
  z.boolean(),
  z.number().finite(),
  z.string().trim().min(1).max(64),
  z.null(),
]);

const safeFieldValueSchemas = {
  role: z.enum(["admin", "member", "client"]),
  status: z.enum(["invited", "active", "ready", "suspended", "pending", "accepted", "expired", "revoked", "completed", "completed_with_issues", "archived", "removed", "failed", "backlog", "todo", "in_progress", "blocked", "done"]),
  visibility: z.enum(["internal", "client-visible"]),
  billable: z.boolean(),
  enabled: z.boolean(),
  outcome: z.enum(["succeeded", "denied", "failed"]),
  projectStatus: z.enum(["active", "on_hold", "completed", "archived"]),
  membershipStatus: z.enum(["invited", "active", "suspended", "removed"]),
  clientReportingStatus: z.enum(["internal", "approved"]),
  deliveryStatus: z.enum(["queued", "sent", "delivered", "delivery_delayed", "bounced", "complained", "failed", "suppressed"]),
  approvalStatus: z.enum(["pending", "approved", "rejected", "expired", "executed", "failed"]),
  organizationCreated: z.boolean(),
  membershipCreated: z.boolean(),
  selectionCreated: z.boolean(),
  migrationMarkerCreated: z.boolean(),
  onboardingStep: z.enum(["profile", "organization", "project", "education", "complete"]),
  onboardingCompleted: z.boolean(),
  projectCreated: z.boolean(),
  nameChanged: z.boolean(),
  timezoneChanged: z.boolean(),
  exportFormat: z.enum(["csv", "json"]),
  notificationPreferencesChanged: z.boolean(),
  workTargetChanged: z.boolean(),
  webhookOutcome: z.enum(["applied", "stale", "duplicate"]),
} satisfies Record<SafeAuditField, z.ZodType>;

export function safeAuditFieldValue(
  field: SafeAuditField,
  value: unknown,
): unknown | undefined {
  if (value === null) return null;
  const result = safeFieldValueSchemas[field].safeParse(value);
  return result.success ? result.data : undefined;
}

export const auditChangeSchema = z.object({
  field: z.enum(SAFE_AUDIT_FIELDS),
  from: safeAuditValueSchema.optional(),
  to: safeAuditValueSchema.optional(),
}).strict().refine((change) => "from" in change || "to" in change, {
  message: "An audit change requires a from or to value",
});

export const auditEventDraftSchema = z.object({
  organizationId: z.string().trim().min(1).max(128),
  projectId: z.string().trim().min(1).max(128).nullable(),
  actor: auditActorSchema,
  action: auditActionSchema,
  target: auditTargetSchema,
  outcome: auditOutcomeSchema,
  changes: z.array(auditChangeSchema).max(32),
  reasonCode: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/).nullable(),
  requestId: z.string().uuid(),
  runId: z.string().uuid().nullable(),
  ipHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  userAgentSummary: z.string().trim().min(1).max(160).nullable(),
  schemaVersion: z.literal(AUDIT_SCHEMA_VERSION),
}).strict().superRefine((event, context) => {
  const allowed = new Set<string>(AUDIT_CHANGE_ALLOWLIST[event.action]);
  event.changes.forEach((change, index) => {
    if (!allowed.has(change.field)) {
      context.addIssue({
        code: "custom",
        path: ["changes", index, "field"],
        message: `Field is not allowed for ${event.action}`,
      });
    }

    for (const side of ["from", "to"] as const) {
      if (side in change && safeAuditFieldValue(change.field, change[side]) === undefined) {
        context.addIssue({
          code: "custom",
          path: ["changes", index, side],
          message: `Value is not safe for ${change.field}`,
        });
      }
    }
  });
});

export const auditEventSchema = auditEventDraftSchema.safeExtend({
  id: z.string().min(1),
  occurredAt: timestampSchema,
}).strict();

export type AuditActor = z.infer<typeof auditActorSchema>;
export type AuditTarget = z.infer<typeof auditTargetSchema>;
export type AuditOutcome = z.infer<typeof auditOutcomeSchema>;
export type AuditChange = z.infer<typeof auditChangeSchema>;
export type AuditEventDraft = z.infer<typeof auditEventDraftSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
