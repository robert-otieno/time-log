import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DB_PATH = path.join(process.cwd(), "tracker.db");
const exists = fs.existsSync(DB_PATH);
const sqlite = new Database(DB_PATH);

export const db = drizzle(sqlite, { schema }); // ✅ Drizzle client

// Create tables if they don't exist
if (!exists) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS daily_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT 'work',
      deadline TEXT,
      reminder_time TEXT,
      notes TEXT,
      link TEXT,
      file_refs TEXT,
      weekly_priority_id INTEGER REFERENCES weekly_priorities(id),
      done INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rhythm_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weekly_priorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      week_start TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT 'work'
    );
    
    CREATE TABLE IF NOT EXISTS rhythm_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      date TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS daily_subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(task_id) REFERENCES daily_tasks(id)
    );
  `);

  // Seed rhythm tasks
  sqlite.prepare("INSERT INTO rhythm_tasks (name) VALUES (?)").run("Sleep 8 hrs");
  sqlite.prepare("INSERT INTO rhythm_tasks (name) VALUES (?)").run("Exercise 30 mins");
} else {
  const dailyColumns = sqlite.prepare("PRAGMA table_info(daily_tasks);").all() as { name: string }[];
  const hasDailyTag = dailyColumns.some((c) => c.name === "tag");
  if (!hasDailyTag) {
    sqlite.exec("ALTER TABLE daily_tasks ADD COLUMN tag TEXT NOT NULL DEFAULT 'work';");
  }

  const hasDeadline = dailyColumns.some((c) => c.name === "deadline");
  if (!hasDeadline) {
    sqlite.exec("ALTER TABLE daily_tasks ADD COLUMN deadline TEXT;");
  }

  const hasReminder = dailyColumns.some((c) => c.name === "reminder_time");
  if (!hasReminder) {
    sqlite.exec("ALTER TABLE daily_tasks ADD COLUMN reminder_time TEXT;");
  }

  const hasNotes = dailyColumns.some((c) => c.name === "notes");
  if (!hasNotes) {
    sqlite.exec("ALTER TABLE daily_tasks ADD COLUMN notes TEXT;");
  }

  const hasLink = dailyColumns.some((c) => c.name === "link");
  if (!hasLink) {
    sqlite.exec("ALTER TABLE daily_tasks ADD COLUMN link TEXT;");
  }

  const hasFileRefs = dailyColumns.some((c) => c.name === "file_refs");
  if (!hasFileRefs) {
    sqlite.exec("ALTER TABLE daily_tasks ADD COLUMN file_refs TEXT;");
  }

  const hasPriorityFk = dailyColumns.some((c) => c.name === "weekly_priority_id");
  if (!hasPriorityFk) {
    sqlite.exec("ALTER TABLE daily_tasks ADD COLUMN weekly_priority_id INTEGER REFERENCES weekly_priorities(id);");
  }

  const weeklyColumns = sqlite.prepare("PRAGMA table_info(weekly_priorities);").all() as { name: string }[];
  const hasWeeklyTag = weeklyColumns.some((c) => c.name === "tag");
  if (!hasWeeklyTag) {
    sqlite.exec("ALTER TABLE weekly_priorities ADD COLUMN tag TEXT NOT NULL DEFAULT 'work';");
  }
  const subtaskColumns = sqlite.prepare("PRAGMA table_info(daily_subtasks);").all() as { name: string }[];
  const hasSubtaskPriority = subtaskColumns.some((c) => c.name === "weekly_priority_id");
  if (hasSubtaskPriority) {
    sqlite.exec("ALTER TABLE daily_subtasks DROP COLUMN weekly_priority_id;");
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS daily_subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(task_id) REFERENCES daily_tasks(id)
    );
  `);
}
