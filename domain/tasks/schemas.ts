import { z } from "zod";
import { DEFAULT_VISIBILITY, visibilitySchema } from "@/domain/visibility/schemas";

const id = z.string().trim().min(1).max(128);
const timestamp = z.custom<{ seconds: number; nanoseconds: number }>((value) => typeof value === "object" && value !== null && "seconds" in value && "nanoseconds" in value, "Expected a Firestore timestamp");
export const taskStatusSchema = z.enum(["backlog", "todo", "in_progress", "blocked", "done"]);
export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const projectTaskSchema = z.object({
  id,
  projectId: id,
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(10000).nullable(),
  assigneeIds: z.array(id).max(50),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  dueAt: timestamp.nullable(),
  dueTimeSet: z.boolean().default(false),
  visibility: visibilitySchema,
  parentTaskId: id.nullable(),
  boardColumnId: id.nullable(),
  sortOrder: z.number().finite().min(0),
  completedAt: timestamp.nullable(),
  archivedAt: timestamp.nullable(),
  migrationSource: z.object({ kind: z.literal("legacy-user-v1"), sourceCollection: z.enum(["daily_tasks", "daily_subtasks"]), sourceId: id, sourcePath: z.string().trim().min(1).max(512), version: z.literal(1), migratedAt: timestamp }).strict().nullable().default(null),
  createdBy: id,
  createdAt: timestamp,
  updatedBy: id,
  updatedAt: timestamp,
}).strict().superRefine((task, context) => {
  if ((task.status === "done") !== (task.completedAt !== null)) context.addIssue({ code: "custom", path: ["completedAt"], message: "Done tasks require completedAt and other tasks must not have it" });
  if (task.parentTaskId === task.id) context.addIssue({ code: "custom", path: ["parentTaskId"], message: "A task cannot be its own parent" });
});

const editable = {
  title: z.string().trim().min(1).max(240), description: z.string().trim().max(10000).nullable(),
  assigneeIds: z.array(id).max(50).transform((values) => [...new Set(values)]), priority: taskPrioritySchema,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null), dueAt: z.string().datetime({ offset: true }).nullable(), dueTimeSet: z.boolean().default(false), visibility: visibilitySchema,
  parentTaskId: id.nullable(), boardColumnId: id.nullable(), sortOrder: z.number().finite().min(0),
};
function validateDueFields(value: { dueDate: string | null; dueAt: string | null; dueTimeSet: boolean }, context: z.RefinementCtx) {
  if (value.dueTimeSet && (!value.dueDate || !value.dueAt)) context.addIssue({ code: "custom", path: ["dueAt"], message: "A timed deadline requires both a date and time" });
  if (!value.dueTimeSet && value.dueAt) context.addIssue({ code: "custom", path: ["dueAt"], message: "A date-only deadline must not contain a timestamp" });
}
export const createTaskCommandSchema = z.object({ ...editable, visibility: visibilitySchema.default(DEFAULT_VISIBILITY) }).strict().superRefine(validateDueFields);
export const updateTaskCommandSchema = z.object({ taskId: id, ...editable }).strict().superRefine(validateDueFields);
export const changeTaskStatusCommandSchema = z.object({ taskId: id, status: taskStatusSchema }).strict();
export const archiveTaskCommandSchema = z.object({ taskId: id }).strict();
export const restoreTaskCommandSchema = z.object({ taskId: id }).strict();
export const taskQuerySchema = z.object({
  statuses: z.array(taskStatusSchema).max(5).optional(), assigneeId: id.optional(),
  visibility: visibilitySchema.optional(), includeArchived: z.boolean().default(false), limit: z.number().int().min(1).max(100).default(50),
}).strict();

export type ProjectTask = z.infer<typeof projectTaskSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
