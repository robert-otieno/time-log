import { z } from "zod";

export const visibilitySchema = z.enum(["internal", "client-visible"]);
export const DEFAULT_VISIBILITY = "internal" as const;

export const changeVisibilityCommandSchema = z.object({
  recordId: z.string().trim().min(1).max(128),
  visibility: visibilitySchema,
}).strict();

export type Visibility = z.infer<typeof visibilitySchema>;
export type ChangeVisibilityCommand = z.infer<typeof changeVisibilityCommandSchema>;

