import { describe, expect, it } from "vitest";
import { educationStepSchema, profileStepSchema } from "@/domain/onboarding/schemas";

const profile = {
  step: "profile", displayName: "Casey", timezone: "America/Los_Angeles",
  workingHours: { days: ["mon", "tue", "wed", "thu", "fri"], start: "09:00", end: "17:00" },
  emailPreferences: { assignments: true, mentions: true, reminders: true, digest: true },
};

describe("onboarding schemas", () => {
  it("accepts a valid localized profile", () => expect(profileStepSchema.safeParse(profile).success).toBe(true));
  it("rejects invalid timezones and reversed working hours", () => {
    expect(profileStepSchema.safeParse({ ...profile, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(profileStepSchema.safeParse({ ...profile, workingHours: { ...profile.workingHours, start: "18:00", end: "09:00" } }).success).toBe(false);
  });
  it("requires education acknowledgement", () => {
    expect(educationStepSchema.safeParse({ step: "education", acknowledged: false }).success).toBe(false);
    expect(educationStepSchema.safeParse({ step: "education", acknowledged: true }).success).toBe(true);
  });
});

