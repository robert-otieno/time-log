import { z } from "zod";

export const createInvitationCommandSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  role: z.enum(["admin", "project_admin", "member", "client"]),
  client: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("none") }).strict(),
    z.object({ mode: z.literal("existing"), clientId: z.string().min(1).max(128) }).strict(),
    z.object({ mode: z.literal("create"), name: z.string().trim().min(1).max(120) }).strict(),
  ]),
  projectIds: z.array(z.string().min(1).max(128)).max(100),
}).strict().superRefine((value, context) => {
  if (value.role === "client" && value.client.mode === "none") {
    context.addIssue({ code: "custom", path: ["client"], message: "Client invitations require a client company" });
  }
  if (value.role !== "client" && value.client.mode !== "none") {
    context.addIssue({ code: "custom", path: ["client"], message: "Internal invitations cannot reference a client company" });
  }
  if (value.role === "project_admin" && value.projectIds.length === 0) {
    context.addIssue({ code: "custom", path: ["projectIds"], message: "Project administrators require at least one project" });
  }
});

export const membershipAccessCommandSchema = z.object({
  userId: z.string().min(1).max(128),
  action: z.enum(["suspend", "restore", "remove"]),
}).strict();

export const acceptInvitationCommandSchema = z.object({
  organizationId: z.string().min(1).max(128),
  invitationId: z.string().min(1).max(128),
  token: z.string().min(32).max(256),
}).strict();
