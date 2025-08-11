"use server";
import { db } from "@/db";
import { dailyTasks, rhythmTasks, weeklyPriorities } from "@/db/schema";
import { eq } from "drizzle-orm";

// --- Daily Tasks ---
export async function getTodayTasks(date: string) {
  return db.select().from(dailyTasks).where(eq(dailyTasks.date, date));
}

export async function addDailyTask(title: string, date: string) {
  return db.insert(dailyTasks).values({ title, date, done: false }).run();
}

export async function toggleDailyTask(id: number, done: boolean) {
  return db.update(dailyTasks).set({ done }).where(eq(dailyTasks.id, id)).run();
}

export async function deleteDailyTask(id: number) {
  return db.delete(dailyTasks).where(eq(dailyTasks.id, id)).run();
}

// --- Rhythm Tasks ---
export async function getRhythmTasks() {
  return db.select().from(rhythmTasks);
}

export async function addRhythmTask(name: string) {
  return db.insert(rhythmTasks).values({ name }).run();
}

// --- Weekly Priorities ---
export async function getWeeklyPriorities(weekStart: string) {
  return db
    .select()
    .from(weeklyPriorities)
    .where(eq(weeklyPriorities.weekStart, weekStart));
}

export async function addWeeklyPriority(title: string, weekStart: string) {
  return db.insert(weeklyPriorities).values({ title, weekStart }).run();
}

export async function deleteWeeklyPriority(id: number) {
  return db.delete(weeklyPriorities).where(eq(weeklyPriorities.id, id)).run();
}
