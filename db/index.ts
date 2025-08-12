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
  `);

  // Seed rhythm tasks
  sqlite.prepare("INSERT INTO rhythm_tasks (name) VALUES (?)").run("Sleep 8 hrs");
  sqlite.prepare("INSERT INTO rhythm_tasks (name) VALUES (?)").run("Exercise 30 mins");
} else {
  const dailyColumns = sqlite
    .prepare("PRAGMA table_info(daily_tasks);")
    .all() as { name: string }[];
  const hasDailyTag = dailyColumns.some((c) => c.name === "tag");
  if (!hasDailyTag) {
    sqlite.exec(
      "ALTER TABLE daily_tasks ADD COLUMN tag TEXT NOT NULL DEFAULT 'work';"
    );
  }

  const weeklyColumns = sqlite
    .prepare("PRAGMA table_info(weekly_priorities);")
    .all() as { name: string }[];
  const hasWeeklyTag = weeklyColumns.some((c) => c.name === "tag");
  if (!hasWeeklyTag) {
    sqlite.exec(
      "ALTER TABLE weekly_priorities ADD COLUMN tag TEXT NOT NULL DEFAULT 'work';"
    );
  }
}
