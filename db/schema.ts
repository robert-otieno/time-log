import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const weeklyPriorities = sqliteTable("weekly_priorities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  weekStart: text("week_start").notNull(),
  tag: text("tag").notNull().default("work"),
});

export const rhythmTasks = sqliteTable("rhythm_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull()
});

export const rhythmCompletions = sqliteTable("rhythm_completions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id").notNull(),
  date: text("date").notNull()
});

export const dailyTasks = sqliteTable("daily_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  date: text("date").notNull(),
  tag: text("tag").notNull().default("work"),
  done: integer("done", { mode: "boolean" }).notNull().default(false)
});

export type DailyTask = typeof dailyTasks.$inferSelect;
