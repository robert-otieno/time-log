import "server-only";

import { createHash } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";

import type { AuditCorrelation } from "@/domain/audit/correlation";
import {
  AuditedCommandError,
  executeAuditedCommand,
  type AuditWriter,
} from "@/domain/audit/command";
import {
  legacyMigrationMarkerSchema,
  organizationMemberSchema,
  organizationSchema,
} from "@/domain/organizations/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

const PERSONAL_PREFIX = "personal-";
const DEFAULT_ORGANIZATION_NAME = "My workspace";

export interface PersonalOrganizationBootstrapResult {
  organizationId: string;
  created: {
    organization: boolean;
    membership: boolean;
    selection: boolean;
    migrationMarker: boolean;
  };
}

interface BootstrapDependencies {
  db?: Firestore;
  auditRepository?: AuditWriter;
}

export class OrganizationBootstrapConflictError extends AuditedCommandError {
  constructor(reasonCode: "organization_owner_conflict" | "membership_conflict" | "migration_marker_conflict") {
    super("failed", reasonCode, "Personal organization bootstrap state conflicts with the authenticated user.");
    this.name = "OrganizationBootstrapConflictError";
  }
}

export function personalOrganizationId(userId: string): string {
  const digest = createHash("sha256").update(userId).digest("hex").slice(0, 32);
  return `${PERSONAL_PREFIX}${digest}`;
}

export function personalOrganizationName(displayName: string | null): string {
  const normalized = displayName?.trim();
  if (!normalized) return DEFAULT_ORGANIZATION_NAME;
  const suffix = "’s workspace";
  return `${normalized.slice(0, 120 - suffix.length)}${suffix}`;
}

export async function ensurePersonalOrganization(
  actor: AuthActor,
  correlation: AuditCorrelation,
  dependencies: BootstrapDependencies = {},
): Promise<PersonalOrganizationBootstrapResult> {
  const db = dependencies.db ?? getAdminDb();
  const organizationId = personalOrganizationId(actor.uid);
  const organizationRef = db.doc(`organizations/${organizationId}`);
  const membershipRef = db.doc(`organizations/${organizationId}/members/${actor.uid}`);
  const selectionRef = db.doc(`users/${actor.uid}/preferences/workspace`);
  const migrationRef = db.doc(`organizations/${organizationId}/migrations/legacy-user-v1`);

  return executeAuditedCommand({
    db,
    auditRepository: dependencies.auditRepository,
    organizationId,
    projectId: null,
    actor: { type: "user", id: actor.uid, role: null },
    action: "organization.bootstrap.completed",
    target: { type: "organization", id: organizationId },
    correlation,
    shouldAuditSuccess: (result) => Object.values(result.created).some(Boolean),
    changes: (result) => [
      { field: "organizationCreated", to: result.created.organization },
      { field: "membershipCreated", to: result.created.membership },
      { field: "selectionCreated", to: result.created.selection },
      { field: "migrationMarkerCreated", to: result.created.migrationMarker },
    ],
    execute: async (transaction) => {
      const organizationSnapshot = await transaction.get(organizationRef);
      const membershipSnapshot = await transaction.get(membershipRef);
      const selectionSnapshot = await transaction.get(selectionRef);
      const migrationSnapshot = await transaction.get(migrationRef);

      if (organizationSnapshot.exists) {
        const data = organizationSnapshot.data();
        if (data?.ownerId !== actor.uid || data.kind !== "personal") {
          throw new OrganizationBootstrapConflictError("organization_owner_conflict");
        }
        organizationSchema.parse({ id: organizationSnapshot.id, ...data });
      }

      if (membershipSnapshot.exists) {
        const data = membershipSnapshot.data();
        if (data?.userId !== actor.uid || data.role !== "admin" || data.status !== "active" || data.clientId !== null) {
          throw new OrganizationBootstrapConflictError("membership_conflict");
        }
        organizationMemberSchema.parse(data);
      }

      if (migrationSnapshot.exists) {
        const data = migrationSnapshot.data();
        if (data?.organizationId !== organizationId || data.sourceUserId !== actor.uid || data.sourcePath !== `users/${actor.uid}`) {
          throw new OrganizationBootstrapConflictError("migration_marker_conflict");
        }
        legacyMigrationMarkerSchema.parse(data);
      }

      const created = {
        organization: !organizationSnapshot.exists,
        membership: !membershipSnapshot.exists,
        selection: !selectionSnapshot.exists,
        migrationMarker: !migrationSnapshot.exists,
      };
      const now = FieldValue.serverTimestamp();

      if (created.organization) {
        transaction.create(organizationRef, {
          kind: "personal",
          name: personalOrganizationName(actor.displayName),
          slug: organizationId,
          timezone: "UTC",
          ownerId: actor.uid,
          onboardingState: "not_started",
          createdAt: now,
          updatedAt: now,
        });
      }
      if (created.membership) {
        transaction.create(membershipRef, {
          userId: actor.uid,
          role: "admin",
          status: "active",
          clientId: null,
          joinedAt: now,
        });
      }
      if (created.selection) {
        transaction.create(selectionRef, {
          activeOrganizationId: organizationId,
          source: "bootstrap",
          updatedAt: now,
        });
      }
      if (created.migrationMarker) {
        transaction.create(migrationRef, {
          organizationId,
          sourceUserId: actor.uid,
          sourcePath: `users/${actor.uid}`,
          status: "pending",
          schemaVersion: 1,
          createdAt: now,
          updatedAt: now,
        });
      }

      return { organizationId, created };
    },
  });
}
