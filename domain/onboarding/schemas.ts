import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const weekdaySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export const onboardingStepSchema = z.enum(["profile", "organization", "project", "education", "complete"]);

export const profileStepSchema = z.object({
  step: z.literal("profile"),
  displayName: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(100).superRefine((value, context) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); }
    catch { context.addIssue({ code: "custom", message: "Choose a valid timezone" }); }
  }),
  workingHours: z.object({
    days: z.array(weekdaySchema).min(1).max(7),
    start: timeSchema,
    end: timeSchema,
  }).strict().refine((value) => value.start < value.end, { path: ["end"], message: "End time must be after start time" }),
  emailPreferences: z.object({
    assignments: z.boolean(),
    mentions: z.boolean(),
    reminders: z.boolean(),
    digest: z.boolean(),
  }).strict(),
}).strict();

export const organizationStepSchema = z.object({
  step: z.literal("organization"),
  name: z.string().trim().min(1).max(120),
}).strict();

export const projectStepSchema = z.object({
  step: z.literal("project"),
  name: z.string().trim().min(1).max(120),
}).strict();

export const educationStepSchema = z.object({
  step: z.literal("education"),
  acknowledged: z.boolean().refine((value) => value, "Confirm the guidance to finish"),
}).strict();

export const onboardingCommandSchema = z.discriminatedUnion("step", [
  profileStepSchema,
  organizationStepSchema,
  projectStepSchema,
  educationStepSchema,
]);

const timestampSchema = z.custom<{ seconds: number; nanoseconds: number }>((value) =>
  typeof value === "object" && value !== null && "seconds" in value && "nanoseconds" in value,
);

export const onboardingStateSchema = z.object({
  schemaVersion: z.literal(1),
  userId: z.string().min(1),
  currentStep: onboardingStepSchema,
  completedSteps: z.array(z.enum(["profile", "organization", "project", "education"])),
  profile: profileStepSchema.omit({ step: true }).nullable(),
  firstProjectId: z.string().min(1).nullable(),
  updatedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
}).strict();

export type OnboardingCommand = z.infer<typeof onboardingCommandSchema>;
export type OnboardingState = z.infer<typeof onboardingStateSchema>;
