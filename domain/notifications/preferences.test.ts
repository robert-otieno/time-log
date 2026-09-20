import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { categoryEnabled, emailPreferencesSchema, loadNotificationPreferences } from "@/domain/notifications/preferences";

const timestamp = { seconds: 1, nanoseconds: 0 };
const actor = { type: "user" as const, uid: "u1", email: "u1@example.com", emailVerified: true, displayName: "Casey" };

function dbWith(records: Record<string, Record<string, unknown>>) {
  return { doc: (path: string) => ({ get: async () => ({ exists: Boolean(records[path]), id: path.split("/").at(-1), data: () => records[path] }) }) } as unknown as Firestore;
}

describe("notification preferences", () => {
  it("validates explicit digest frequency and categories", () => expect(emailPreferencesSchema.parse({ assignments: true, mentions: false, reminders: true, announcements: false, digestFrequency: "daily" })).toMatchObject({ digestFrequency: "daily" }));
  it("maps legacy onboarding digest preferences to weekly", async () => {
    const db = dbWith({
      "organizations/o1/members/u1": { userId: "u1", email: "u1@example.com", displayName: "Casey", role: "member", status: "active", clientId: null, joinedAt: timestamp },
      "organizations/o1": { kind: "team", name: "Acme", slug: "acme", timezone: "UTC", ownerId: "admin", onboardingState: "complete", createdAt: timestamp, updatedAt: timestamp },
      "organizations/o1/onboarding/u1": { schemaVersion: 1, userId: "u1", currentStep: "complete", completedSteps: ["profile", "organization", "project", "education"], profile: { displayName: "Casey", timezone: "America/Los_Angeles", workingHours: { days: ["mon"], start: "09:00", end: "17:00" }, emailPreferences: { assignments: false, mentions: true, reminders: false, digest: true } }, firstProjectId: "p1", updatedAt: timestamp, completedAt: timestamp },
    });
    await expect(loadNotificationPreferences(actor, "o1", db)).resolves.toMatchObject({ timezone: "America/Los_Angeles", email: { assignments: false, reminders: false, announcements: true, digestFrequency: "weekly" } });
  });
  it("enforces category switches", () => expect(categoryEnabled({ schemaVersion: 1, userId: "u1", timezone: "UTC", email: { assignments: false, mentions: true, reminders: true, announcements: true, digestFrequency: "off" }, updatedAt: timestamp }, "assignment")).toBe(false));
});
