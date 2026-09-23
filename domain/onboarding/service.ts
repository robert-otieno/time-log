import "server-only";

import { FieldValue, type Firestore } from "firebase-admin/firestore";

import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { personalOrganizationId } from "@/domain/organizations/bootstrap";
import { organizationMemberSchema, organizationSchema, projectSchema } from "@/domain/organizations/schemas";
import { onboardingCommandSchema, onboardingStateSchema, type OnboardingState } from "@/domain/onboarding/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

export const ONBOARDING_PROJECT_ID = "onboarding-first";
const STEPS = ["profile", "organization", "project", "education"] as const;

interface Dependencies { db?: Firestore; auditRepository?: AuditWriter }
interface SaveResult { currentStep: "profile" | "organization" | "project" | "education" | "complete"; projectCreated: boolean }

function nextStep(completed: readonly string[]) {
  return STEPS.find((step) => !completed.includes(step)) ?? "complete";
}

function initialState(userId: string): Omit<OnboardingState, "updatedAt"> {
  return { schemaVersion: 1, userId, currentStep: "profile", completedSteps: [], profile: null, firstProjectId: null, completedAt: null };
}

export async function getOnboardingState(actor: AuthActor, db: Firestore = getAdminDb()): Promise<OnboardingState | null> {
  const organizationId = personalOrganizationId(actor.uid);
  const snapshot = await db.doc(`organizations/${organizationId}/onboarding/${actor.uid}`).get();
  return snapshot.exists ? onboardingStateSchema.parse(snapshot.data()) : null;
}

export async function saveOnboardingStep(actor: AuthActor, raw: unknown, correlation: AuditCorrelation, dependencies: Dependencies = {}) {
  const command = onboardingCommandSchema.parse(raw);
  const db = dependencies.db ?? getAdminDb();
  const organizationId = personalOrganizationId(actor.uid);
  const organizationRef = db.doc(`organizations/${organizationId}`);
  const membershipRef = db.doc(`organizations/${organizationId}/members/${actor.uid}`);
  const stateRef = db.doc(`organizations/${organizationId}/onboarding/${actor.uid}`);
  const projectRef = db.doc(`organizations/${organizationId}/projects/${ONBOARDING_PROJECT_ID}`);
  const actions = {
    profile: "organization.onboarding.profile.saved",
    organization: "organization.onboarding.organization.saved",
    project: "organization.onboarding.project.saved",
    education: "organization.onboarding.completed",
  } as const;

  return executeAuditedCommand<SaveResult>({
    db, auditRepository: dependencies.auditRepository, organizationId, projectId: command.step === "project" ? ONBOARDING_PROJECT_ID : null,
    actor: { type: "user", id: actor.uid, role: "admin" }, action: actions[command.step],
    target: { type: command.step === "project" ? "project" : "organization", id: command.step === "project" ? ONBOARDING_PROJECT_ID : organizationId },
    correlation,
    changes: (result) => command.step === "project"
      ? [{ field: "onboardingStep", to: result.currentStep }, { field: "projectCreated", to: result.projectCreated }]
      : command.step === "education"
        ? [{ field: "onboardingStep", to: "complete" }, { field: "onboardingCompleted", to: true }]
        : [{ field: "onboardingStep", to: result.currentStep }],
    execute: async (transaction) => {
      const organizationSnapshot = await transaction.get(organizationRef);
      const membershipSnapshot = await transaction.get(membershipRef);
      const stateSnapshot = await transaction.get(stateRef);
      const projectSnapshot = await transaction.get(projectRef);
      if (!organizationSnapshot.exists || !membershipSnapshot.exists) throw new AuditedCommandError("denied", "organization_access_denied", "Organization access denied");
      const organization = organizationSchema.parse({ id: organizationSnapshot.id, ...organizationSnapshot.data() });
      const membership = organizationMemberSchema.parse(membershipSnapshot.data());
      if (organization.ownerId !== actor.uid || membership.role !== "admin" || membership.status !== "active") throw new AuditedCommandError("denied", "organization_access_denied", "Organization access denied");

      const state = stateSnapshot.exists ? onboardingStateSchema.parse(stateSnapshot.data()) : initialState(actor.uid);
      const requiredIndex = STEPS.indexOf(command.step);
      if (STEPS.slice(0, requiredIndex).some((step) => !state.completedSteps.includes(step))) throw new AuditedCommandError("denied", "onboarding_step_out_of_order", "Complete earlier onboarding steps first");
      const completedSteps = Array.from(new Set([...state.completedSteps, command.step]));
      const now = FieldValue.serverTimestamp();
      let profile = state.profile;
      let firstProjectId = state.firstProjectId;
      let projectCreated = false;

      if (command.step === "profile") {
        profile = { displayName: command.displayName, timezone: command.timezone, workingHours: command.workingHours, emailPreferences: command.emailPreferences };
        transaction.update(membershipRef, {
          displayName: command.displayName,
          ...(actor.email ? { email: actor.email.trim().toLowerCase() } : {}),
        });
      }
      if (command.step === "organization") transaction.update(organizationRef, { name: command.name, onboardingState: "in_progress", updatedAt: now });
      if (command.step === "project") {
        projectCreated = !projectSnapshot.exists;
        if (projectSnapshot.exists) {
          const existingProject = projectSchema.parse({ id: projectSnapshot.id, ...projectSnapshot.data() });
          if (existingProject.createdBy !== actor.uid || existingProject.key !== "FIRST") throw new AuditedCommandError("failed", "onboarding_project_conflict", "The onboarding project conflicts with existing data");
        }
        transaction.set(projectRef, {
          name: command.name, key: "FIRST", description: null, clientId: null, status: "active",
          enabledTools: ["todos", "time"], defaultVisibility: "internal", templateSource: null,
          createdBy: actor.uid, createdAt: projectSnapshot.exists ? projectSnapshot.data()?.createdAt : now,
          updatedBy: actor.uid, updatedAt: now,
        });
        firstProjectId = ONBOARDING_PROJECT_ID;
      }
      if (command.step === "education") transaction.update(organizationRef, { onboardingState: "complete", timezone: profile?.timezone ?? organization.timezone, updatedAt: now });

      const currentStep = nextStep(completedSteps);
      transaction.set(stateRef, {
        schemaVersion: 1, userId: actor.uid, currentStep, completedSteps, profile, firstProjectId,
        updatedAt: now, completedAt: currentStep === "complete" ? now : null,
      });
      return { currentStep, projectCreated };
    },
  });
}
