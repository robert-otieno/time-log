import "server-only";

import type { Firestore, Transaction } from "firebase-admin/firestore";

import { AuditRepository } from "@/domain/audit/repository";
import {
  AUDIT_SCHEMA_VERSION,
  auditEventDraftSchema,
  type AuditActor,
  type AuditEventDraft,
  type AuditTarget,
} from "@/domain/audit/schemas";
import type { AuditAction } from "@/domain/audit/actions";
import { redactAuditChanges, type UnsafeAuditChange } from "@/domain/audit/redaction";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { getAdminDb } from "@/lib/firebase-admin";

export class AuditedCommandError extends Error {
  constructor(
    readonly outcome: "denied" | "failed",
    readonly reasonCode: string,
    message: string,
  ) {
    super(message);
    this.name = "AuditedCommandError";
  }
}

export class AuditPersistenceError extends Error {
  readonly code = "audit_persistence_failed";

  constructor(options: { cause: unknown }) {
    super("The action could not be safely recorded.", options);
    this.name = "AuditPersistenceError";
  }
}

interface AuditCommandDetails {
  organizationId: string;
  projectId: string | null;
  actor: AuditActor;
  action: AuditAction;
  target: AuditTarget;
  correlation: AuditCorrelation;
  ipHash?: string | null;
  userAgentSummary?: string | null;
}

export interface AuditedCommandOptions<T> extends AuditCommandDetails {
  db?: Firestore;
  auditRepository?: AuditWriter;
  changes?: readonly UnsafeAuditChange[] | ((result: T) => readonly UnsafeAuditChange[]);
  shouldAuditSuccess?: (result: T) => boolean;
  additionalSuccessAudits?: (result: T) => readonly {
    action: AuditAction;
    target: AuditTarget;
    projectId?: string | null;
    changes?: readonly UnsafeAuditChange[];
  }[];
  execute(transaction: Transaction): Promise<T>;
}

export interface AuditWriter {
  append(draft: AuditEventDraft): Promise<{ id: string }>;
  appendInTransaction(transaction: Transaction, draft: AuditEventDraft): { id: string };
}

function draftFor(
  details: AuditCommandDetails,
  outcome: AuditEventDraft["outcome"],
  reasonCode: string | null,
  changes: readonly UnsafeAuditChange[],
): AuditEventDraft {
  return auditEventDraftSchema.parse({
    organizationId: details.organizationId,
    projectId: details.projectId,
    actor: details.actor,
    action: details.action,
    target: details.target,
    outcome,
    changes: redactAuditChanges(details.action, changes),
    reasonCode,
    requestId: details.correlation.requestId,
    runId: details.correlation.runId,
    ipHash: details.ipHash ?? null,
    userAgentSummary: details.userAgentSummary ?? null,
    schemaVersion: AUDIT_SCHEMA_VERSION,
  });
}

export async function executeAuditedCommand<T>(
  options: AuditedCommandOptions<T>,
): Promise<T> {
  const db = options.db ?? getAdminDb();
  const auditRepository = options.auditRepository ?? new AuditRepository(db);

  try {
    return await db.runTransaction(async (transaction) => {
      const result = await options.execute(transaction);
      if (options.shouldAuditSuccess?.(result) ?? true) {
        const changes = typeof options.changes === "function"
          ? options.changes(result)
          : options.changes ?? [];
        auditRepository.appendInTransaction(
          transaction,
          draftFor(options, "succeeded", null, changes),
        );
        for (const additional of options.additionalSuccessAudits?.(result) ?? []) {
          auditRepository.appendInTransaction(transaction, draftFor({
            ...options,
            action: additional.action,
            target: additional.target,
            projectId: additional.projectId ?? options.projectId,
          }, "succeeded", null, additional.changes ?? []));
        }
      }
      return result;
    });
  } catch (error) {
    const outcome = error instanceof AuditedCommandError ? error.outcome : "failed";
    const reasonCode = error instanceof AuditedCommandError
      ? error.reasonCode
      : "internal_error";

    try {
      await auditRepository.append(draftFor(options, outcome, reasonCode, []));
    } catch (auditError) {
      throw new AuditPersistenceError({ cause: { actionError: error, auditError } });
    }

    throw error;
  }
}
