import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const weeklyPriorities = sqliteTable("weekly_priorities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  weekStart: text("week_start").notNull()
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
  done: integer("done", { mode: "boolean" }).default(false)
});
