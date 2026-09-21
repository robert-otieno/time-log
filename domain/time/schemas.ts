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

export const clientReportingStatusSchema = z.enum(["internal", "approved"]);

export const timeEntrySchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  projectId: idSchema,
  taskId: idSchema.nullable(),
  userId: idSchema,
  source: z.enum(["timer", "manual"]),
  startedAt: timestampSchema,
  endedAt: timestampSchema,
  durationSeconds: z.number().int().positive().max(31_622_400),
  note: z.string().trim().max(2000).nullable(),
  billable: z.boolean(),
  clientReportingStatus: clientReportingStatusSchema,
  correctionCount: z.number().int().min(0),
  createdBy: idSchema,
  createdAt: timestampSchema,
  updatedBy: idSchema,
  updatedAt: timestampSchema,
}).strict();

const entryFields = {
  note: z.string().trim().max(2000).nullable().default(null),
  billable: z.boolean().default(false),
  clientReportingStatus: clientReportingStatusSchema.default("internal"),
};
export const stopTimerCommandSchema = z.object({ ...entryFields, completeTask: z.boolean().default(false) }).strict();
export const createManualEntryCommandSchema = z.object({
  taskId: idSchema.nullable().default(null),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }),
  ...entryFields,
}).strict();
export const correctTimeEntryCommandSchema = z.object({
  entryId: idSchema,
  taskId: idSchema.nullable(),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }),
  ...entryFields,
}).strict();

export type ActiveTimer = z.infer<typeof activeTimerSchema>;
export type ActiveTimerPointer = z.infer<typeof activeTimerPointerSchema>;
export type StartTimerCommand = z.infer<typeof startTimerCommandSchema>;
export type TimeEntry = z.infer<typeof timeEntrySchema>;
