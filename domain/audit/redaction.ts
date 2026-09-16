import {
  AUDIT_CHANGE_ALLOWLIST,
  type AuditAction,
  type SafeAuditField,
} from "@/domain/audit/actions";
import { safeAuditFieldValue, type AuditChange } from "@/domain/audit/schemas";

export interface UnsafeAuditChange {
  field: string;
  from?: unknown;
  to?: unknown;
}

export function redactAuditChanges(
  action: AuditAction,
  changes: readonly UnsafeAuditChange[],
): AuditChange[] {
  const allowed = new Set<string>(AUDIT_CHANGE_ALLOWLIST[action]);

  return changes.flatMap((change) => {
    if (!allowed.has(change.field)) return [];

    const field = change.field as SafeAuditField;
    const redacted: { field: SafeAuditField; from?: unknown; to?: unknown } = { field };

    if ("from" in change) {
      const value = safeAuditFieldValue(field, change.from);
      if (value !== undefined) redacted.from = value;
    }
    if ("to" in change) {
      const value = safeAuditFieldValue(field, change.to);
      if (value !== undefined) redacted.to = value;
    }

    return "from" in redacted || "to" in redacted
      ? [redacted as AuditChange]
      : [];
  });
}
