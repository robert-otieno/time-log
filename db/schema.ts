import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const weeklyPriorities = sqliteTable("weekly_priorities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  weekStart: text("week_start").notNull(),
  tag: text("tag").notNull().default("work"),
});

export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull(),
  title: text("title").notNull(),
  deadline: text("deadline"),
});

export const rhythmTasks = sqliteTable("rhythm_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  goalId: integer("goal_id").references(() => goals.id),
  type: text("type").notNull().default("checkbox"),
  target: integer("target").notNull().default(1),
  scheduleMask: text("schedule_mask").notNull().default("MTWTF--"),
});

export const habitCompletions = sqliteTable("habit_completions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  habitId: integer("habit_id").notNull(),
  date: text("date").notNull(),
  value: integer("value").notNull().default(0),
});

export { habitCompletions as rhythmCompletions };

export const nudgeEvents = sqliteTable("nudge_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  habitId: integer("habit_id").notNull(),
  date: text("date").notNull(),
  remaining: integer("remaining").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
});

export const dailyTasks = sqliteTable("daily_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  date: text("date").notNull(),
  tag: text("tag").notNull().default("work"),
  deadline: text("deadline"),
  reminderTime: text("reminder_time"),
  notes: text("notes"),
  link: text("link"),
  fileRefs: text("file_refs"),
  weeklyPriorityId: integer("weekly_priority_id").references(() => weeklyPriorities.id),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
});

export const dailySubtasks = sqliteTable("daily_subtasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id").notNull(),
  title: text("title").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
});

export type DailyTask = typeof dailyTasks.$inferSelect;
export type DailySubtask = typeof dailySubtasks.$inferSelect;
export type TaskWithSubtasks = DailyTask & {
  notes: string | null;
  link: string | null;
  fileRefs: string | null;
  subtasks: DailySubtask[];
  priority?: typeof weeklyPriorities.$inferSelect;
};
export type NudgeEvent = typeof nudgeEvents.$inferSelect;
