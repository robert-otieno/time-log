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
      done INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rhythm_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weekly_priorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      week_start TEXT NOT NULL
    );
  `);

  // Seed rhythm tasks
  sqlite.prepare("INSERT INTO rhythm_tasks (name) VALUES (?)").run("Sleep 8 hrs");
  sqlite.prepare("INSERT INTO rhythm_tasks (name) VALUES (?)").run("Exercise 30 mins");
}
