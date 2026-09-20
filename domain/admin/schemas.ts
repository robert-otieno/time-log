import { z } from "zod";

const id = z.string().trim().min(1).max(128);

export const updateOrganizationSettingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(100).superRefine((value, context) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); }
    catch { context.addIssue({ code: "custom", message: "Choose a valid timezone" }); }
  }),
}).strict();

export const changeMemberRoleSchema = z.object({ userId: id, role: z.enum(["admin", "member"]) }).strict();
export const changeProjectAssignmentSchema = z.object({ userId: id, projectId: id, action: z.enum(["assign", "remove"]) }).strict();
