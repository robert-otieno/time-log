import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DB_PATH = path.join(process.cwd(), "tracker.db");
const exists = fs.existsSync(DB_PATH);
const sqlite = new Database(DB_PATH);

export const db = drizzle(sqlite, { schema });

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

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      deadline TEXT
    );

    CREATE TABLE IF NOT EXISTS rhythm_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      goal_id INTEGER REFERENCES goals(id),
      type TEXT NOT NULL DEFAULT 'checkbox',
      target INTEGER NOT NULL DEFAULT 1,
      schedule_mask TEXT NOT NULL DEFAULT 'MTWTF--'
    );

    CREATE TABLE IF NOT EXISTS weekly_priorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      week_start TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT 'work'
    );
    
    CREATE TABLE IF NOT EXISTS habit_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      value INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(habit_id) REFERENCES rhythm_tasks(id)
    );
    
    CREATE TABLE IF NOT EXISTS daily_subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(task_id) REFERENCES daily_tasks(id)
    );
  `);

  const goal = sqlite.prepare("INSERT INTO goals (category, title, deadline) VALUES (?, ?, ?)").run("health", "Wellness", null);
  const goalId = Number(goal.lastInsertRowid);
  sqlite.prepare("INSERT INTO rhythm_tasks (name, goal_id) VALUES (?, ?)").run("Sleep 8 hrs", goalId);
  sqlite.prepare("INSERT INTO rhythm_tasks (name, goal_id) VALUES (?, ?)").run("Exercise 30 mins", goalId);
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
  const goalsTable = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='goals'").get();
  if (!goalsTable) {
    sqlite.exec(`
      CREATE TABLE goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        deadline TEXT
      );
    `);
  }
  const rhythmColumns = sqlite.prepare("PRAGMA table_info(rhythm_tasks);").all() as { name: string }[];
  const hasGoalId = rhythmColumns.some((c) => c.name === "goal_id");
  if (!hasGoalId) {
    sqlite.exec("ALTER TABLE rhythm_tasks ADD COLUMN goal_id INTEGER REFERENCES goals(id);");
  }

  const hasType = rhythmColumns.some((c) => c.name === "type");
  if (!hasType) {
    sqlite.exec("ALTER TABLE rhythm_tasks ADD COLUMN type TEXT NOT NULL DEFAULT 'checkbox';");
  }
  const hasTarget = rhythmColumns.some((c) => c.name === "target");
  if (!hasTarget) {
    sqlite.exec("ALTER TABLE rhythm_tasks ADD COLUMN target INTEGER NOT NULL DEFAULT 1;");
  }
  const hasScheduleMask = rhythmColumns.some((c) => c.name === "schedule_mask");
  if (!hasScheduleMask) {
    sqlite.exec("ALTER TABLE rhythm_tasks ADD COLUMN schedule_mask TEXT NOT NULL DEFAULT 'MTWTF--';");
  }
  const habitTable = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='habit_completions'").get();
  if (!habitTable) {
    const oldHabit = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rhythm_completions'").get();
    if (oldHabit) {
      sqlite.exec("ALTER TABLE rhythm_completions RENAME TO habit_completions;");
    } else {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS habit_completions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          habit_id INTEGER NOT NULL,
          date TEXT NOT NULL,
          FOREIGN KEY(habit_id) REFERENCES rhythm_tasks(id)
        );
      `);
    }
  }
  const habitColumns = sqlite.prepare("PRAGMA table_info(habit_completions);").all() as { name: string }[];
  const hasHabitId = habitColumns.some((c) => c.name === "habit_id");
  if (!hasHabitId && habitColumns.some((c) => c.name === "task_id")) {
    sqlite.exec("ALTER TABLE habit_completions RENAME COLUMN task_id TO habit_id;");
  }
  const hasValue = habitColumns.some((c) => c.name === "value");
  if (!hasValue) {
    sqlite.exec("ALTER TABLE habit_completions ADD COLUMN value INTEGER NOT NULL DEFAULT 0;");
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
