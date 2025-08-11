"use server";
import { db } from "@/db";
import { dailyTasks, rhythmTasks, weeklyPriorities } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getTodayTasks(date: string) {
  let tasks = await db
    .select()
    .from(dailyTasks)
    .where(eq(dailyTasks.date, date));

  if (tasks.length === 0) {
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const prevDate = yesterday.toISOString().split("T")[0];

    const template = await db
      .select()
      .from(dailyTasks)
      .where(eq(dailyTasks.date, prevDate));

    if (template.length > 0) {
      await db
        .insert(dailyTasks)
        .values(
          template.map((t) => ({
            title: t.title,
            date,
            done: false,
          }))
        )
        .run();

      tasks = await db
        .select()
        .from(dailyTasks)
        .where(eq(dailyTasks.date, date));
    }
  }

  return tasks;
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

export async function getRhythmTasks() {
  return db.select().from(rhythmTasks);
}

export async function addRhythmTask(name: string) {
  return db.insert(rhythmTasks).values({ name }).run();
}

export async function getWeeklyPriorities(weekStart: string) {
  let priorities = await db
    .select()
    .from(weeklyPriorities)
    .where(eq(weeklyPriorities.weekStart, weekStart));

  if (priorities.length === 0) {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    const prevWeek = prev.toISOString().split("T")[0];

    const template = await db
      .select()
      .from(weeklyPriorities)
      .where(eq(weeklyPriorities.weekStart, prevWeek));

    if (template.length > 0) {
      await db
        .insert(weeklyPriorities)
        .values(
          template.map((p) => ({
            title: p.title,
            weekStart,
          }))
        )
        .run();

      priorities = await db
        .select()
        .from(weeklyPriorities)
        .where(eq(weeklyPriorities.weekStart, weekStart));
    }
  }

  return priorities;
}

export async function addWeeklyPriority(title: string, weekStart: string) {
  return db.insert(weeklyPriorities).values({ title, weekStart }).run();
}

export async function deleteWeeklyPriority(id: number) {
  return db.delete(weeklyPriorities).where(eq(weeklyPriorities.id, id)).run();
}
