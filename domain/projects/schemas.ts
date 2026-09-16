import { z } from "zod";

export const projectToolSchema = z.enum(["todos", "time", "messages", "docs", "calendar", "chat", "board", "check-ins", "email-forwards", "links"]);
const projectFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000).nullable(),
  clientId: z.string().min(1).max(128).nullable(),
  enabledTools: z.array(projectToolSchema).min(1).max(10).transform((tools) => Array.from(new Set(tools))),
};

export const createProjectCommandSchema = z.object(projectFields).strict();
export const updateProjectCommandSchema = z.object({ projectId: z.string().min(1).max(128), ...projectFields }).strict();
export const changeProjectStatusCommandSchema = z.object({
  projectId: z.string().min(1).max(128),
  status: z.enum(["active", "on_hold", "completed", "archived"]),
}).strict();
export const selectProjectCommandSchema = z.object({ projectId: z.string().min(1).max(128) }).strict();

export type ProjectTool = z.infer<typeof projectToolSchema>;
