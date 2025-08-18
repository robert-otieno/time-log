"use server";

import { db } from "@/db";
import { dailyTasks, dailySubtasks, rhythmTasks, weeklyPriorities, goals, habitCompletions, type TaskWithSubtasks, type DailySubtask } from "@/db/schema";
import { formatISODate } from "@/lib/date-utils";
import { eq, desc, inArray, and, gte, lte } from "drizzle-orm";

export async function getTodayTasks(date: string): Promise<TaskWithSubtasks[]> {
  try {
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

      const template = await db
        .select()
        .from(dailyTasks)
        .where(and(eq(dailyTasks.date, prevDate), eq(dailyTasks.done, false)));

      if (template.length > 0) {
        await db.transaction(async (tx) => {
          for (const t of template) {
            const inserted = await tx
              .insert(dailyTasks)
              .values({
                title: t.title,
                date,
                tag: t.tag,
                deadline: t.deadline,
                reminderTime: t.reminderTime,
                notes: t.notes,
                link: t.link,
                fileRefs: t.fileRefs,
                weeklyPriorityId: t.weeklyPriorityId,
                done: false,
              })
              .run();

            const newTaskId = Number(inserted.lastInsertRowid);

            const subtasks = await tx.select().from(dailySubtasks).where(eq(dailySubtasks.taskId, t.id));

            if (subtasks.length > 0) {
              await tx
                .insert(dailySubtasks)
                .values(
                  subtasks.map((s) => ({
                    taskId: newTaskId,
                    title: s.title,
                    done: false,
                  }))
                )
                .run();
            }
          }
        });

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
  } catch (error) {
    console.error("Error in getTodayTasks:", error);
    throw error;
  }
}

export async function getTaskDates(): Promise<string[]> {
  try {
    const dates = await db.selectDistinct({ date: dailyTasks.date }).from(dailyTasks).orderBy(desc(dailyTasks.date));
    return dates.map((d) => d.date);
  } catch (error) {
    console.error("Error in getTaskDates:", error);
    throw error;
  }
}

export async function addDailyTask(
  title: string,
  date: string,
  tag: string = "work",
  deadline?: string | null,
  reminderTime?: string | null,
  weeklyPriorityId?: number,
  notes?: string | null,
  link?: string | null,
  fileRefs?: string | null
) {
  try {
    return await db
      .insert(dailyTasks)
      .values({
        title,
        date,
        tag,
        deadline,
        reminderTime,
        weeklyPriorityId,
        notes,
        link,
        fileRefs,
        done: false,
      })
      .run();
  } catch (error) {
    console.error("Error in addDailyTask:", error);
    throw error;
  }
}

export async function toggleDailyTask(id: number, done: boolean) {
  try {
    return await db.update(dailyTasks).set({ done }).where(eq(dailyTasks.id, id)).run();
  } catch (error) {
    console.error("Error in toggleDailyTask:", error);
    throw error;
  }
}

export async function deleteDailyTask(id: number) {
  try {
    return await db.delete(dailyTasks).where(eq(dailyTasks.id, id)).run();
  } catch (error) {
    console.error("Error in deleteDailyTask:", error);
    throw error;
  }
}

export async function addDailySubtask(taskId: number, title: string) {
  try {
    return await db.insert(dailySubtasks).values({ taskId, title, done: false }).run();
  } catch (error) {
    console.error("Error in addDailySubtask:", error);
    throw error;
  }
}

export async function toggleDailySubtask(id: number, done: boolean) {
  try {
    return await db.update(dailySubtasks).set({ done }).where(eq(dailySubtasks.id, id)).run();
  } catch (error) {
    console.error("Error in toggleDailySubtask:", error);
    throw error;
  }
}

export async function updateDailyTask(
  id: number,
  fields: {
    title?: string;
    tag?: string;
    deadline?: string | null;
    reminderTime?: string | null;
    weeklyPriorityId?: number | null;
    notes?: string | null;
    link?: string | null;
    fileRefs?: string | null;
  }
) {
  return db.update(dailyTasks).set(fields).where(eq(dailyTasks.id, id)).run();
}

export async function updateTaskDetails(id: number, fields: { notes?: string | null; link?: string | null; fileRefs?: string | null }) {
  return db.update(dailyTasks).set(fields).where(eq(dailyTasks.id, id)).run();
}

export async function deleteDailySubtask(id: number) {
  try {
    return db.delete(dailySubtasks).where(eq(dailySubtasks.id, id)).run();
  } catch (error) {
    console.error("Error in deleteDailySubtask:", error);
    throw error;
  }
}

export type HabitWithCompletions = typeof rhythmTasks.$inferSelect & { completions: string[] };
export type GoalWithHabits = typeof goals.$inferSelect & { habits: HabitWithCompletions[] };

export async function getGoalsWithHabits(): Promise<GoalWithHabits[]> {
  try {
    const rows = await db
      .select({ goal: goals, habit: rhythmTasks, completion: habitCompletions })
      .from(goals)
      .leftJoin(rhythmTasks, eq(rhythmTasks.goalId, goals.id))
      .leftJoin(habitCompletions, eq(habitCompletions.habitId, rhythmTasks.id));

    const goalMap = new Map<number, GoalWithHabits>();

    for (const row of rows) {
      const g = row.goal;
      if (!goalMap.has(g.id)) {
        goalMap.set(g.id, { ...g, habits: [] });
      }
      if (row.habit) {
        const goal = goalMap.get(g.id)!;
        let habit = goal.habits.find((h) => h.id === row.habit.id);
        if (!habit) {
          habit = { ...row.habit, completions: [] };
          goal.habits.push(habit);
        }
        if (row.completion) {
          habit.completions.push(row.completion.date);
        }
      }
    }

    return Array.from(goalMap.values());
  } catch (error) {
    console.error("Error in getGoalsWithHabits:", error);
    throw error;
  }
}

export async function addGoal(category: string, title: string, deadline?: string | null) {
  try {
    return db.insert(goals).values({ category, title, deadline }).run();
  } catch (error) {
    console.error("Error in addGoal:", error);
    throw error;
  }
}

export async function addHabit(goalId: number, name: string) {
  try {
    return db.insert(rhythmTasks).values({ goalId, name }).run();
  } catch (error) {
    console.error("Error in addHabit:", error);
    throw error;
  }
}

export async function toggleHabitCompletion(habitId: number, date: string) {
  try {
    const existing = await db
      .select({ id: habitCompletions.id })
      .from(habitCompletions)
      .where(and(eq(habitCompletions.habitId, habitId), eq(habitCompletions.date, date)));

    if (existing.length > 0) {
      return db.delete(habitCompletions).where(eq(habitCompletions.id, existing[0].id)).run();
    } else {
      return db.insert(habitCompletions).values({ habitId, date }).run();
    }
  } catch (error) {
    console.error("Error in toggleHabitCompletion:", error);
    throw error;
  }
}

export async function updateGoal(id: number, fields: Partial<{ category: string; title: string; deadline: string | null }>) {
  try {
    return db.update(goals).set(fields).where(eq(goals.id, id)).run();
  } catch (error) {
    console.error("Error in updateGoal:", error);
    throw error;
  }
}

export async function deleteGoal(id: number) {
  try {
    await db.transaction(async (tx) => {
      const habits = await tx.select({ id: rhythmTasks.id }).from(rhythmTasks).where(eq(rhythmTasks.goalId, id));
      const habitIds = habits.map((h) => h.id);
      if (habitIds.length > 0) {
        await tx.delete(habitCompletions).where(inArray(habitCompletions.habitId, habitIds)).run();
        await tx.delete(rhythmTasks).where(inArray(rhythmTasks.id, habitIds)).run();
      }
      await tx.delete(goals).where(eq(goals.id, id)).run();
    });
  } catch (error) {
    console.error("Error in deleteGoal:", error);
    throw error;
  }
}

export async function getRhythmTasks() {
  try {
    return db.select().from(rhythmTasks);
  } catch (error) {
    console.error("Error in getRhythmTasks:", error);
    throw error;
  }
}

export async function addRhythmTask(name: string) {
  try {
    return db.insert(rhythmTasks).values({ name }).run();
  } catch (error) {
    console.error("Error in addRhythmTask:", error);
    throw error;
  }
}

export async function getWeeklyPriorities(weekStart: string) {
  try {
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
  } catch (error) {
    console.error("Error in getWeeklyPriorities:", error);
    throw error;
  }
}

export async function addWeeklyPriority(title: string, weekStart: string, tag: string) {
  try {
    return await db.insert(weeklyPriorities).values({ title, weekStart, tag }).run();
  } catch (error) {
    console.error("Error in addWeeklyPriority:", error);
    throw error;
  }
}

export async function updateWeeklyPriority(id: number, fields: Partial<{ title: string; weekStart: string; tag: string }>) {
  try {
    return db.update(weeklyPriorities).set(fields).where(eq(weeklyPriorities.id, id)).run();
  } catch (error) {
    console.error("Error in updateWeeklyPriority:", error);
    throw error;
  }
}

export async function deleteWeeklyPriority(id: number) {
  try {
    return await db.delete(weeklyPriorities).where(eq(weeklyPriorities.id, id)).run();
  } catch (error) {
    console.error("Error in deleteWeeklyPriority:", error);
    throw error;
  }
}
