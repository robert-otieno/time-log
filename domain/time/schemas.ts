import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128);
const timestampSchema = z.custom<{ seconds: number; nanoseconds: number }>(
  (value) => typeof value === "object" && value !== null && "seconds" in value && "nanoseconds" in value,
  "Expected a Firestore timestamp",
);

export const activeTimerSchema = z.object({
  userId: idSchema,
  organizationId: idSchema,
  projectId: idSchema,
  taskId: idSchema.nullable(),
  startedAt: timestampSchema,
  note: z.string().trim().max(2000).nullable(),
}).strict();

export const activeTimerPointerSchema = z.object({
  organizationId: idSchema,
  projectId: idSchema,
  userId: idSchema,
  startedAt: timestampSchema,
}).strict();

export const startTimerCommandSchema = z.object({
  taskId: idSchema.nullable().default(null),
  note: z.string().trim().max(2000).nullable().default(null),
}).strict();

export type ActiveTimer = z.infer<typeof activeTimerSchema>;
export type ActiveTimerPointer = z.infer<typeof activeTimerPointerSchema>;
export type StartTimerCommand = z.infer<typeof startTimerCommandSchema>;
