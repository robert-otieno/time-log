import { z } from "zod";

export const membershipRoleSchema = z.enum(["admin", "member", "client"]);
export const membershipStatusSchema = z.enum(["invited", "active", "suspended", "removed"]);
export const projectStatusSchema = z.enum(["active", "on_hold", "completed", "archived"]);

const timestampSchema = z.custom<{ seconds: number; nanoseconds: number }>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    "nanoseconds" in value,
  "Expected a Firestore timestamp",
);

export const organizationSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["personal", "team"]),
  name: z.string().trim().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  timezone: z.string().trim().min(1).max(100),
  ownerId: z.string().min(1),
  onboardingState: z.enum(["not_started", "in_progress", "complete"]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).strict();

export const activeOrganizationSelectionSchema = z.object({
  activeOrganizationId: z.string().min(1),
  source: z.enum(["bootstrap", "user"]),
  updatedAt: timestampSchema,
}).strict();

export const legacyMigrationMarkerSchema = z.object({
  organizationId: z.string().min(1),
  sourceUserId: z.string().min(1),
  sourcePath: z.string().regex(/^users\/[^/]+$/),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
  schemaVersion: z.literal(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).strict();

export const organizationMemberSchema = z.object({
  userId: z.string().min(1),
  email: z.string().trim().toLowerCase().email().nullable().optional(),
  displayName: z.string().trim().min(1).max(120).nullable().optional(),
  role: membershipRoleSchema,
  status: membershipStatusSchema,
  clientId: z.string().min(1).nullable(),
  joinedAt: timestampSchema.nullable(),
}).strict().superRefine((member, context) => {
  if (member.role === "client" && member.clientId === null) {
    context.addIssue({ code: "custom", path: ["clientId"], message: "Client memberships require a clientId" });
  }
  if (member.role !== "client" && member.clientId !== null) {
    context.addIssue({ code: "custom", path: ["clientId"], message: "Internal memberships cannot reference a client" });
  }
  if (member.status === "active" && member.joinedAt === null) {
    context.addIssue({ code: "custom", path: ["joinedAt"], message: "Active memberships require joinedAt" });
  }
});

export const clientSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  status: z.enum(["active", "archived"]),
  createdBy: z.string().min(1),
  createdAt: timestampSchema,
  updatedBy: z.string().min(1),
  updatedAt: timestampSchema,
}).strict();

export const invitationSchema = z.object({
  id: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  role: membershipRoleSchema,
  clientId: z.string().min(1).nullable(),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["pending", "accepted", "expired", "revoked"]),
  projectIds: z.array(z.string().min(1)).max(100),
  expiresAt: timestampSchema,
  acceptedBy: z.string().min(1).nullable(),
  acceptedAt: timestampSchema.nullable(),
  createdBy: z.string().min(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).strict().superRefine((invitation, context) => {
  if ((invitation.role === "client") !== (invitation.clientId !== null)) {
    context.addIssue({ code: "custom", path: ["clientId"], message: "Only client invitations reference a client" });
  }
});

export const notificationSchema = z.object({
  id: z.string().min(1),
  type: z.literal("invitation"),
  recipientEmail: z.string().trim().toLowerCase().email(),
  templateData: z.object({
    organizationName: z.string().trim().min(1).max(120),
    inviterName: z.string().trim().min(1).max(120),
    acceptUrl: z.string().url().max(2048),
  }).strict(),
  status: z.enum(["queued", "processing", "sent", "failed"]),
  idempotencyKey: z.string().trim().min(1).max(256),
  providerMessageId: z.string().min(1).nullable(),
  attemptCount: z.number().int().min(0).max(20),
  lastErrorCode: z.string().trim().min(1).max(64).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).strict();

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  key: z.string().trim().regex(/^[A-Z][A-Z0-9]{1,9}$/),
  description: z.string().trim().max(5000).nullable(),
  clientId: z.string().min(1).nullable(),
  status: projectStatusSchema,
  enabledTools: z.array(z.enum(["todos", "time", "messages", "docs", "calendar", "chat", "board", "check-ins", "email-forwards", "links"])),
  defaultVisibility: z.literal("internal"),
  templateSource: z.object({ templateId: z.string().min(1), version: z.number().int().positive() }).nullable(),
  createdBy: z.string().min(1),
  createdAt: timestampSchema,
  updatedBy: z.string().min(1),
  updatedAt: timestampSchema,
}).strict();

export const projectAssignmentSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["active", "removed"]),
  assignedBy: z.string().min(1),
  assignedAt: timestampSchema,
  removedAt: timestampSchema.nullable(),
}).strict().superRefine((assignment, context) => {
  if (assignment.status === "active" && assignment.removedAt !== null) {
    context.addIssue({ code: "custom", path: ["removedAt"], message: "Active assignments cannot have removedAt" });
  }
  if (assignment.status === "removed" && assignment.removedAt === null) {
    context.addIssue({ code: "custom", path: ["removedAt"], message: "Removed assignments require removedAt" });
  }
});

export type Organization = z.infer<typeof organizationSchema>;
export type ActiveOrganizationSelection = z.infer<typeof activeOrganizationSelectionSchema>;
export type LegacyMigrationMarker = z.infer<typeof legacyMigrationMarkerSchema>;
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export type Client = z.infer<typeof clientSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectAssignment = z.infer<typeof projectAssignmentSchema>;
export type MembershipRole = z.infer<typeof membershipRoleSchema>;
