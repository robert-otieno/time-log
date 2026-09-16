import "server-only";

import {
  FieldValue,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";

import { auditEventDraftSchema, type AuditEventDraft } from "@/domain/audit/schemas";
import { getAdminDb } from "@/lib/firebase-admin";

export interface AuditAppendResult {
  id: string;
}

export class AuditRepository {
  constructor(private readonly db: Firestore = getAdminDb()) {}

  async append(draft: AuditEventDraft): Promise<AuditAppendResult> {
    const validated = auditEventDraftSchema.parse(draft);
    const reference = this.collection(validated.organizationId).doc();

    await reference.create({
      id: reference.id,
      ...validated,
      occurredAt: FieldValue.serverTimestamp(),
    });

    return { id: reference.id };
  }

  appendInTransaction(
    transaction: Transaction,
    draft: AuditEventDraft,
  ): AuditAppendResult {
    const validated = auditEventDraftSchema.parse(draft);
    const reference = this.collection(validated.organizationId).doc();

    transaction.create(reference, {
      id: reference.id,
      ...validated,
      occurredAt: FieldValue.serverTimestamp(),
    });

    return { id: reference.id };
  }

  private collection(organizationId: string) {
    return this.db.collection(`organizations/${organizationId}/auditEvents`);
  }
}

