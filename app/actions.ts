"use server";

import { db } from "@/db";
import { formatISODate } from "@/lib/date-utils";
import { collection, query, where, getDocs, setDoc, doc, updateDoc, writeBatch, deleteDoc, addDoc } from "firebase/firestore";

function genId() {
  return Date.now();
}

export interface WeeklyPriority {
  id: number;
  title: string;
  weekStart: string;
  tag: string;
  level: string;
}

export interface DailyTask {
  id: number;
  title: string;
  date: string;
  tag: string;
  deadline?: string | null;
  reminderTime?: string | null;
  notes?: string | null;
  link?: string | null;
  fileRefs?: string | null;
  weeklyPriorityId?: number | null;
  done: boolean;
}

export interface DailySubtask {
  id: number;
  taskId: number;
  title: string;
  done: boolean;
}

export type TaskWithSubtasks = DailyTask & {
  subtasks: DailySubtask[];
  priority?: WeeklyPriority;
};

export interface Goal {
  id: number;
  category: string;
  title: string;
  deadline?: string | null;
}

export interface RhythmTask {
  id: number;
  name: string;
  goalId?: number | null;
  type: string;
  target: number;
  scheduleMask: string;
}

export type HabitCompletion = { date: string; value: number };

export type HabitWithCompletions = RhythmTask & {
  completions: HabitCompletion[];
};

export type GoalWithHabits = Goal & {
  habits: HabitWithCompletions[];
};

function docId(id: number) {
  return id.toString();
}

// Daily tasks ---------------------------------------------------------------
export async function getTodayTasks(date: string): Promise<TaskWithSubtasks[]> {
  // --- helpers ---
  const chunk = <T>(arr: T[], size = 10): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

  // --- tasks ---
  const tasksQ = query(collection(db, "daily_tasks"), where("date", "==", date));
  const tasksSnap = await getDocs(tasksQ);

  const tasks: DailyTask[] = tasksSnap.docs.map((d) => ({
    id: Number(d.id),
    ...(d.data() as any),
  }));

  const taskIds = tasks.map((t) => t.id.toString());

  // --- subtasks (respect 'in' limit of 10) ---
  let subtasks: DailySubtask[] = [];
  if (taskIds.length > 0) {
    const subChunks = chunk(taskIds, 10);
    for (const ids of subChunks) {
      const subsQ = query(collection(db, "daily_subtasks"), where("taskId", "in", ids));
      const subsSnap = await getDocs(subsQ);
      subtasks.push(
        ...subsSnap.docs.map((d) => ({
          id: Number(d.id),
          ...(d.data() as any),
        }))
      );
    }
  }

  // --- weekly priorities (also chunk 'in' queries) ---
  const priorityIds = Array.from(new Set(tasks.map((t) => t.weeklyPriorityId).filter(Boolean))) as number[];

  const priorities: Record<number, WeeklyPriority> = {};
  if (priorityIds.length > 0) {
    const priChunks = chunk(priorityIds, 10);
    for (const ids of priChunks) {
      const priQ = query(collection(db, "weekly_priorities"), where("id", "in", ids));
      const priSnap = await getDocs(priQ);
      priSnap.forEach((doc) => {
        const data = doc.data() as WeeklyPriority & { id: number };
        priorities[data.id] = data;
      });
    }
  }

  return tasks.map((t) => ({
    ...t,
    subtasks: subtasks.filter((s) => s.taskId === t.id),
    priority: t.weeklyPriorityId ? priorities[t.weeklyPriorityId] : undefined,
  }));
}

export async function getTaskDates(): Promise<string[]> {
  const snap = await getDocs(collection(db, "daily_tasks"));

  const dates = Array.from(new Set(snap.docs.map((d) => (d.data() as any).date)));

  // sort ascending then reverse → latest first
  return dates.sort().reverse();
}

export async function addDailyTask(
  title: string,
  date: string,
  tag = "work",
  deadline?: string | null,
  reminderTime?: string | null,
  weeklyPriorityId?: number,
  notes?: string | null,
  link?: string | null,
  fileRefs?: string | null
) {
  const id = genId(); // your own id generator
  const docRef = doc(collection(db, "daily_tasks"), docId(id)); // docId() = your custom mapping

  await setDoc(docRef, {
    title,
    date,
    tag,
    deadline: deadline ?? null,
    reminderTime: reminderTime ?? null,
    notes: notes ?? null,
    link: link ?? null,
    fileRefs: fileRefs ?? null,
    weeklyPriorityId: weeklyPriorityId ?? null,
    done: false,
  });

  return { id };
}

export async function toggleDailyTask(id: number, done: boolean) {
  const taskRef = doc(collection(db, "daily_tasks"), docId(id));
  await updateDoc(taskRef, { done });
}

/** DELETE a task and its subtasks (batch) */
export async function deleteDailyTask(id: number) {
  const taskDocId = docId(id); // ensure this is a string
  const taskRef = doc(collection(db, "daily_tasks"), taskDocId);

  // find subtasks by FK (stored as the parent task's doc id)
  const subsQ = query(collection(db, "daily_subtasks"), where("taskId", "==", taskDocId));
  const subsSnap = await getDocs(subsQ);

  const batch = writeBatch(db);
  batch.delete(taskRef);
  subsSnap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/** CREATE a subtask */
export async function addDailySubtask(taskId: number, title: string) {
  const id = genId();
  const subRef = doc(collection(db, "daily_subtasks"), docId(id));

  await setDoc(subRef, {
    taskId: docId(taskId), // FK stored as string doc id
    title,
    done: false,
  });

  return { id };
}

/** TOGGLE a subtask */
export async function toggleDailySubtask(id: number, done: boolean) {
  const subRef = doc(collection(db, "daily_subtasks"), docId(id));
  await updateDoc(subRef, { done });
}

/** UPDATE a task (partial) */
export async function updateDailyTask(id: number, fields: Partial<DailyTask>) {
  const taskRef = doc(collection(db, "daily_tasks"), docId(id));
  await updateDoc(taskRef, fields as any);
}

// ---------------- Tasks ----------------

export async function updateTaskDetails(id: number, fields: { notes?: string | null; link?: string | null; fileRefs?: string | null }) {
  const taskRef = doc(collection(db, "daily_tasks"), docId(id));
  await updateDoc(taskRef, fields as any);
}

export async function deleteDailySubtask(id: number) {
  const subRef = doc(collection(db, "daily_subtasks"), docId(id));
  await deleteDoc(subRef);
}

// -------------- Goals & Habits ----------------

export async function getGoalsWithHabits(date: string = formatISODate(new Date())): Promise<GoalWithHabits[]> {
  // goals
  const goalsSnap = await getDocs(collection(db, "goals"));
  const goals: Goal[] = goalsSnap.docs.map((d) => ({
    id: Number(d.id),
    ...(d.data() as any),
  }));

  // habits
  const habitsSnap = await getDocs(collection(db, "rhythm_tasks"));
  const habits: RhythmTask[] = habitsSnap.docs.map((d) => ({
    id: Number(d.id),
    ...(d.data() as any),
  }));

  // completions for the date
  const compsQ = query(collection(db, "habit_completions"), where("date", "==", date));
  const completionsSnap = await getDocs(compsQ);
  const completions = completionsSnap.docs.map((d) => ({ ...(d.data() as any) }));

  // assemble
  return goals.map((g) => ({
    ...g,
    habits: habits
      .filter((h) => h.goalId === g.id)
      .map((h) => ({
        ...h,
        completions: completions.filter((c) => c.habitId === h.id).map((c) => ({ date: c.date, value: c.value })),
      })),
  }));
}

/** GOALS */
export async function addGoal(category: string, title: string, deadline?: string | null) {
  const id = genId();
  const goalRef = doc(collection(db, "goals"), docId(id));
  await setDoc(goalRef, {
    category,
    title,
    deadline: deadline ?? null,
  });
  return { id };
}

export async function updateGoal(id: number, fields: Partial<{ category: string; title: string; deadline: string | null }>) {
  const goalRef = doc(collection(db, "goals"), docId(id));
  await updateDoc(goalRef, fields as any);
}

/** HABITS */
export async function addHabit(goalId: number, name: string, type = "checkbox", target = 1, scheduleMask = "MTWTF--") {
  const id = genId();
  const habitRef = doc(collection(db, "rhythm_tasks"), docId(id));
  await setDoc(habitRef, {
    name,
    goalId, // stored as number; keep consistent across your schema
    type,
    target,
    scheduleMask,
  });
  return { id };
}

export async function deleteHabit(id: number) {
  const habitRef = doc(collection(db, "rhythm_tasks"), docId(id));

  // delete completions tied to this habit in a batch
  const compsQ = query(collection(db, "habit_completions"), where("habitId", "==", id));
  const compsSnap = await getDocs(compsQ);

  const batch = writeBatch(db);
  batch.delete(habitRef);
  compsSnap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/** HABIT COMPLETIONS */
export async function toggleHabitCompletion(habitId: number, date: string, value = 1) {
  // Find existing completion for (habitId, date)
  const q = query(collection(db, "habit_completions"), where("habitId", "==", habitId), where("date", "==", date));
  const snap = await getDocs(q);

  if (snap.empty) {
    // Create new completion doc
    await addDoc(collection(db, "habit_completions"), { habitId, date, value });
  } else {
    // Update first matching completion
    await updateDoc(snap.docs[0].ref, { value });
  }
}

// Small helpers
const chunk = <T>(arr: T[], size = 10): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

/** Delete a goal, all its habits, and their completions. */
export async function deleteGoal(id: number) {
  const goalDocId = docId(id); // ensure this returns a string

  // 1) Fetch habits linked to the goal
  const habitsQ = query(collection(db, "rhythm_tasks"), where("goalId", "==", id));
  const habitsSnap = await getDocs(habitsQ);

  // Compute habit doc IDs (string) and the numeric FK values used in completions
  const habitDocIds = habitsSnap.docs.map((d) => d.id);
  const habitIdNumbers = habitsSnap.docs.map((d) => Number(d.id)); // adjust if you store habitId as string

  // 2) Delete the goal + its habits in a single batch
  {
    const batch = writeBatch(db);
    // delete goal
    batch.delete(doc(collection(db, "goals"), goalDocId));
    // delete all habit docs for this goal
    for (const hid of habitDocIds) {
      batch.delete(doc(collection(db, "rhythm_tasks"), hid));
    }
    await batch.commit();
  }

  // 3) Delete completions for those habits (respect `in` limit=10; also avoid huge batches)
  if (habitIdNumbers.length > 0) {
    for (const ids of chunk(habitIdNumbers, 10)) {
      const compsQ = query(collection(db, "habit_completions"), where("habitId", "in", ids));
      const compsSnap = await getDocs(compsQ);

      // Commit deletions in batches to stay under Firestore write limits
      const batch = writeBatch(db);
      compsSnap.forEach((c) => batch.delete(c.ref));
      await batch.commit();
    }
  }
}

/** Read all rhythm tasks (habits). */
export async function getRhythmTasks() {
  const snap = await getDocs(collection(db, "rhythm_tasks"));
  return snap.docs.map((d) => ({ id: Number(d.id), ...(d.data() as any) }));
}

/** Create a rhythm task (habit) with a generated ID. */
export async function addRhythmTask(name: string) {
  const id = genId();
  const ref = doc(collection(db, "rhythm_tasks"), docId(id)); // string ID
  await setDoc(ref, { name });
  return { id };
}

/** Get weekly priorities + computed progress from tasks in the same week */
export async function getWeeklyPriorities(weekStart: string) {
  // 1) priorities for the given week
  const priQ = query(collection(db, "weekly_priorities"), where("weekStart", "==", weekStart));
  const prioritiesSnap = await getDocs(priQ);

  const priorities: WeeklyPriority[] = prioritiesSnap.docs.map((d) => ({
    id: Number(d.id),
    ...(d.data() as any),
  }));

  // 2) tasks within weekStart..weekEnd
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const tasksQ = query(collection(db, "daily_tasks"), where("date", ">=", weekStart), where("date", "<=", formatISODate(weekEnd)));
  const tasksSnap = await getDocs(tasksQ);

  const tasks = tasksSnap.docs.map((d) => ({
    id: Number(d.id),
    ...(d.data() as any),
  }));

  // 3) compute progress per priority
  return priorities.map((p) => {
    const related = tasks.filter((t) => t.weeklyPriorityId === p.id);
    const total = related.length;
    const completed = related.filter((t) => t.done).length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { ...p, progress, completed: total > 0 && completed === total };
  });
}

/** Create a weekly priority */
export async function addWeeklyPriority(title: string, weekStart: string, tag: string, level: string) {
  const id = genId();
  const ref = doc(collection(db, "weekly_priorities"), docId(id));
  await setDoc(ref, { id, title, weekStart, tag, level });
  return { id };
}

/** Patch a weekly priority */
export async function updateWeeklyPriority(id: number, fields: Partial<{ title: string; weekStart: string; tag: string; level: string }>) {
  const ref = doc(collection(db, "weekly_priorities"), docId(id));
  await updateDoc(ref, fields as any);
}

export async function deleteWeeklyPriority(id: number) {
  const ref = doc(collection(db, "weekly_priorities"), docId(id));
  await deleteDoc(ref);
}
