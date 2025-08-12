"use server";
import { db } from "@/db";
import { dailyTasks, dailySubtasks, rhythmTasks, weeklyPriorities, type TaskWithSubtasks, type DailySubtask } from "@/db/schema";
import { formatISODate } from "@/lib/date-utils";
import { eq, desc, inArray, and, gte, lte } from "drizzle-orm";

export async function getTodayTasks(date: string): Promise<TaskWithSubtasks[]> {
  let tasks = await db
    .select({
      task: dailyTasks,
      priority: weeklyPriorities,
    })
    .from(dailyTasks)
    .leftJoin(weeklyPriorities, eq(dailyTasks.weeklyPriorityId, weeklyPriorities.id))
    .where(eq(dailyTasks.date, date));

  if (tasks.length === 0) {
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const prevDate = formatISODate(yesterday);

    const template = await db.select().from(dailyTasks).where(eq(dailyTasks.date, prevDate));

    if (template.length > 0) {
      await db
        .insert(dailyTasks)
        .values(
          template.map((t) => ({
            title: t.title,
            date,
            tag: t.tag,
            deadline: t.deadline,
            reminderTime: t.reminderTime,
            weeklyPriorityId: t.weeklyPriorityId,
            done: false,
          }))
        )
        .run();

      tasks = await db
        .select({
          task: dailyTasks,
          priority: weeklyPriorities,
        })
        .from(dailyTasks)
        .leftJoin(weeklyPriorities, eq(dailyTasks.weeklyPriorityId, weeklyPriorities.id))
        .where(eq(dailyTasks.date, date));
    }
  }

  const taskIds = tasks.map((t) => t.task.id);
  let subtasks: DailySubtask[] = [];
  if (taskIds.length > 0) {
    subtasks = await db.select().from(dailySubtasks).where(inArray(dailySubtasks.taskId, taskIds));
  }

  return tasks.map((t) => ({
    ...t.task,
    priority: t.priority ?? undefined,
    subtasks: subtasks.filter((s) => s.taskId === t.task.id),
  }));
}

export async function getTaskDates(): Promise<string[]> {
  const dates = await db.selectDistinct({ date: dailyTasks.date }).from(dailyTasks).orderBy(desc(dailyTasks.date));

  return dates.map((d) => d.date);
}

export async function addDailyTask(
  title: string,
  date: string,
  tag: string = "work",
  deadline?: string | null,
  reminderTime?: string | null,
  weeklyPriorityId?: number
) {
  return db.insert(dailyTasks).values({ title, date, tag, deadline, reminderTime, weeklyPriorityId, done: false }).run();
}

export async function toggleDailyTask(id: number, done: boolean) {
  return db.update(dailyTasks).set({ done }).where(eq(dailyTasks.id, id)).run();
}

export async function deleteDailyTask(id: number) {
  return db.delete(dailyTasks).where(eq(dailyTasks.id, id)).run();
}

export async function addDailySubtask(taskId: number, title: string) {
  return db.insert(dailySubtasks).values({ taskId, title, done: false }).run();
}

export async function toggleDailySubtask(id: number, done: boolean) {
  return db.update(dailySubtasks).set({ done }).where(eq(dailySubtasks.id, id)).run();
}

export async function deleteDailySubtask(id: number) {
  return db.delete(dailySubtasks).where(eq(dailySubtasks.id, id)).run();
}

export async function getRhythmTasks() {
  return db.select().from(rhythmTasks);
}

export async function addRhythmTask(name: string) {
  return db.insert(rhythmTasks).values({ name }).run();
}

export async function getWeeklyPriorities(weekStart: string) {
  let priorities = await db.select().from(weeklyPriorities).where(eq(weeklyPriorities.weekStart, weekStart));

  if (priorities.length === 0) {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    const prevWeek = formatISODate(prev);

    const template = await db.select().from(weeklyPriorities).where(eq(weeklyPriorities.weekStart, prevWeek));

    if (template.length > 0) {
      await db
        .insert(weeklyPriorities)
        .values(
          template.map((p) => ({
            title: p.title,
            weekStart,
            tag: p.tag,
          }))
        )
        .run();

      priorities = await db.select().from(weeklyPriorities).where(eq(weeklyPriorities.weekStart, weekStart));
    }
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = formatISODate(weekEnd);

  const tasks = await db
    .select({
      weeklyPriorityId: dailyTasks.weeklyPriorityId,
      done: dailyTasks.done,
    })
    .from(dailyTasks)
    .where(and(gte(dailyTasks.date, weekStart), lte(dailyTasks.date, weekEndStr)));

  return priorities.map((p) => {
    const related = tasks.filter((t) => t.weeklyPriorityId === p.id);
    const total = related.length;
    const completed = related.filter((t) => t.done).length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return {
      ...p,
      progress,
      completed: total > 0 && completed === total,
    };
  });
}

export async function addWeeklyPriority(title: string, weekStart: string, tag: string) {
  return db.insert(weeklyPriorities).values({ title, weekStart, tag }).run();
}

export async function deleteWeeklyPriority(id: number) {
  return db.delete(weeklyPriorities).where(eq(weeklyPriorities.id, id)).run();
}
