import "server-only";

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { AuditCorrelation } from "@/domain/audit/correlation";
import { AuditedCommandError, executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { organizationMemberSchema, organizationSchema } from "@/domain/organizations/schemas";
import { onboardingStateSchema } from "@/domain/onboarding/schemas";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";

const timestamp = z.custom<{ seconds: number; nanoseconds: number }>((value) => typeof value === "object" && value !== null && "seconds" in value && "nanoseconds" in value);
const timezone = z.string().trim().min(1).max(100).superRefine((value, context) => { try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); } catch { context.addIssue({ code: "custom", message: "Choose a valid timezone" }); } });
export const emailPreferencesSchema = z.object({ assignments: z.boolean(), mentions: z.boolean(), reminders: z.boolean(), announcements: z.boolean(), digestFrequency: z.enum(["off", "daily", "weekly"]) }).strict();
export const notificationPreferencesSchema = z.object({ schemaVersion: z.literal(1), userId: z.string().min(1), timezone, email: emailPreferencesSchema, updatedAt: timestamp }).strict();
export const updateNotificationPreferencesSchema = z.object({ timezone, email: emailPreferencesSchema }).strict();
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

const defaults = (userId: string, timezoneValue: string, legacy?: { assignments: boolean; mentions: boolean; reminders: boolean; digest: boolean } | null): Omit<NotificationPreferences, "updatedAt"> => ({ schemaVersion: 1, userId, timezone: timezoneValue, email: { assignments: legacy?.assignments ?? true, mentions: legacy?.mentions ?? true, reminders: legacy?.reminders ?? true, announcements: true, digestFrequency: legacy?.digest === false ? "off" : "weekly" } });

export async function loadNotificationPreferences(actor: AuthActor, organizationId: string, db: Firestore = getAdminDb()) {
  const [memberSnapshot, organizationSnapshot, preferenceSnapshot, onboardingSnapshot] = await Promise.all([
    db.doc(`organizations/${organizationId}/members/${actor.uid}`).get(), db.doc(`organizations/${organizationId}`).get(),
    db.doc(`users/${actor.uid}/preferences/notifications`).get(), db.doc(`organizations/${organizationId}/onboarding/${actor.uid}`).get(),
  ]);
  if (!memberSnapshot.exists || !organizationSnapshot.exists) return null;
  const member = organizationMemberSchema.parse(memberSnapshot.data()); if (member.status !== "active") return null;
  if (preferenceSnapshot.exists) return notificationPreferencesSchema.parse(preferenceSnapshot.data());
  const organization = organizationSchema.parse({ id: organizationSnapshot.id, ...organizationSnapshot.data() });
  const onboarding = onboardingSnapshot.exists ? onboardingStateSchema.parse(onboardingSnapshot.data()) : null;
  return { ...defaults(actor.uid, onboarding?.profile?.timezone ?? organization.timezone, onboarding?.profile?.emailPreferences), updatedAt: null };
}

export async function getStoredNotificationPreferences(userId: string, db: Firestore) {
  const snapshot = await db.doc(`users/${userId}/preferences/notifications`).get();
  return snapshot.exists ? notificationPreferencesSchema.parse(snapshot.data()) : null;
}

export async function getEffectiveNotificationPreferences(userId: string, organizationId: string, db: Firestore): Promise<NotificationPreferences | null> {
  const stored = await getStoredNotificationPreferences(userId, db); if (stored) return stored;
  const [organizationSnapshot, onboardingSnapshot] = await Promise.all([db.doc(`organizations/${organizationId}`).get(), db.doc(`organizations/${organizationId}/onboarding/${userId}`).get()]);
  if (!organizationSnapshot.exists) return null;
  const organization = organizationSchema.parse({ id: organizationSnapshot.id, ...organizationSnapshot.data() });
  const onboarding = onboardingSnapshot.exists ? onboardingStateSchema.parse(onboardingSnapshot.data()) : null;
  return { ...defaults(userId, onboarding?.profile?.timezone ?? organization.timezone, onboarding?.profile?.emailPreferences), updatedAt: { seconds: 0, nanoseconds: 0 } };
}

export async function updateNotificationPreferences(actor: AuthActor, organizationId: string, raw: unknown, correlation: AuditCorrelation, dependencies: { db?: Firestore; auditRepository?: AuditWriter } = {}) {
  const command = updateNotificationPreferencesSchema.parse(raw); const db = dependencies.db ?? getAdminDb(); const memberRef = db.doc(`organizations/${organizationId}/members/${actor.uid}`); const preferenceRef = db.doc(`users/${actor.uid}/preferences/notifications`);
  return executeAuditedCommand<{ timezoneChanged: boolean; notificationPreferencesChanged: boolean }>({ db, auditRepository: dependencies.auditRepository, organizationId, projectId: null, actor: { type: "user", id: actor.uid, role: null }, action: "user.preferences.updated", target: { type: "preference", id: actor.uid }, correlation, changes: (result) => [{ field: "timezoneChanged", to: result.timezoneChanged }, { field: "notificationPreferencesChanged", to: result.notificationPreferencesChanged }], execute: async (transaction) => {
    const [memberSnapshot, preferenceSnapshot] = await Promise.all([transaction.get(memberRef), transaction.get(preferenceRef)]); if (!memberSnapshot.exists || organizationMemberSchema.parse(memberSnapshot.data()).status !== "active") throw new AuditedCommandError("denied", "preferences_update_denied", "Preference update denied");
    const previous = preferenceSnapshot.exists ? notificationPreferencesSchema.parse(preferenceSnapshot.data()) : null;
    transaction.set(preferenceRef, { schemaVersion: 1, userId: actor.uid, timezone: command.timezone, email: command.email, updatedAt: FieldValue.serverTimestamp() });
    return { timezoneChanged: previous?.timezone !== command.timezone, notificationPreferencesChanged: JSON.stringify(previous?.email ?? null) !== JSON.stringify(command.email) };
  }});
}

export function categoryEnabled(preferences: NotificationPreferences | null, category: "assignment" | "mention" | "reminder" | "announcement" | "digest") {
  if (!preferences) return true;
  if (category === "assignment") return preferences.email.assignments;
  if (category === "mention") return preferences.email.mentions;
  if (category === "reminder") return preferences.email.reminders;
  if (category === "announcement") return preferences.email.announcements;
  return preferences.email.digestFrequency !== "off";
}
