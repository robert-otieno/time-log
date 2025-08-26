"use server";

import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { FieldValue } from "firebase-admin/firestore";

// import { db } from "@/db";
// import { getCurrentUser } from "@/lib/auth";
// import { formatISODate } from "@/lib/date-utils";
// import { userCol } from "@/lib/user-collection";
// import { FieldValue } from "firebase-admin/firestore";
// import { query, where, getDocs, setDoc, doc, updateDoc, writeBatch, deleteDoc, addDoc } from "firebase/firestore";

// export interface WeeklyPriority {
//   id: number;
//   title: string;
//   weekStart: string;
//   tag: string;
//   level: string;
// }

// export interface DailyTask {
//   id: number;
//   title: string;
//   date: string;
//   tag: string;
//   deadline?: string | null;
//   reminderTime?: string | null;
//   notes?: string | null;
//   link?: string | null;
//   fileRefs?: string | null;
//   weeklyPriorityId?: number | null;
//   done: boolean;
// }
// export interface DailySubtask {
//   id: number;
//   taskId: number;
//   title: string;
//   done: boolean;
// }

// export type TaskWithSubtasks = DailyTask & {
//   subtasks: DailySubtask[];
//   priority?: WeeklyPriority;
// };
// export interface Goal {
//   id: number;
//   category: string;
//   title: string;
//   deadline?: string | null;
// }

// export interface RhythmTask {
//   id: number;
//   name: string;
//   goalId?: number | null;
//   type: string;
//   target: number;
//   scheduleMask: string;
// }

// export type HabitCompletion = { date: string; value: number };

// export type HabitWithCompletions = RhythmTask & {
//   completions: HabitCompletion[];
// };

// export type GoalWithHabits = Goal & {
//   habits: HabitWithCompletions[];
// };

// function docId(id: number) {
//   return id.toString();
// }

// /** Read all rhythm tasks (habits). */
// export async function getRhythmTasks() {
//   const user = await getCurrentUser();
//   if (!user) throw new Error("Not authenticated");
//   const snap = await getDocs(userCol(user.uid, "rhythm_tasks"));
//   return snap.docs.map((d) => ({ id: Number(d.id), ...(d.data() as any) }));
// }

// /** Create a rhythm task (habit) with a generated ID. */
// export async function addRhythmTask(name: string) {
//   const id = genId();
//   const user = await getCurrentUser();
//   if (!user) throw new Error("Not authenticated");
//   const ref = doc(userCol(user.uid, "rhythm_tasks"), docId(id)); // string ID
//   await setDoc(ref, { name });
//   return { id };
// }

type WeeklyPriority = {
  id: string; // doc id (UUID)
  title: string;
  weekStart: string; // "YYYY-MM-DD" (Monday or your chosen start)
  tag?: string | null;
  level?: string | null; // keep as string since your API passes string
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
};

type DailyTask = {
  id: string; // UUID
  weeklyPriorityId?: string | number | null; // string (new) or number (legacy)
  date: string; // "YYYY-MM-DD"
  done: boolean;
};

const COL_PRIORITIES = "weekly_priorities";
const COL_TASKS = "daily_tasks";

function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getWeeklyPriorities(weekStart: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const userDoc = db.collection("users").doc(user.uid);

  // 1) priorities for the given week
  const priSnap = await userDoc.collection(COL_PRIORITIES).where("weekStart", "==", weekStart).get();

  const priorities: WeeklyPriority[] = priSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  if (priorities.length === 0) return [];

  // 2) tasks within weekStart..weekEnd (inclusive)
  const weekEnd = addDaysISO(weekStart, 6);
  const tasksSnap = await userDoc.collection(COL_TASKS).where("date", ">=", weekStart).where("date", "<=", weekEnd).get();

  const tasks: DailyTask[] = tasksSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  // 3) compute progress per priority
  const byStringId = new Map<string, DailyTask[]>();
  const byNumericId = new Map<number, DailyTask[]>();

  for (const t of tasks) {
    const key = t.weeklyPriorityId;
    if (typeof key === "string") {
      const arr = byStringId.get(key) ?? [];
      arr.push(t);
      byStringId.set(key, arr);
    } else if (typeof key === "number") {
      const arr = byNumericId.get(key) ?? [];
      arr.push(t);
      byNumericId.set(key, arr);
    }
  }

  return priorities.map((p) => {
    // Prefer new string linking; fall back to legacy numeric (if your old docs had `id` field stored numerically)
    const related = (byStringId.get(p.id) ?? []).concat(
      // If your legacy weekly_priorities docs stored a numeric `id` field, you can recover it here:
      // tasks linked by number will only match if such a field exists on the priority doc’s data.
      // Comment the following block out once legacy is gone.
      (() => {
        const numericId = (p as any).id as number | undefined; // legacy numeric id on the doc data
        return typeof numericId === "number" ? byNumericId.get(numericId) ?? [] : [];
      })()
    );

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

export async function addWeeklyPriority(title: string, weekStart: string, tag: string, level: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const id = crypto.randomUUID();
  const ref = db.collection("users").doc(user.uid).collection(COL_PRIORITIES).doc(id);

  const payload = {
    id, // persist id for convenience in UI
    title: title.trim(),
    weekStart,
    tag: tag?.trim() ?? null,
    level: level?.trim() ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(payload);
  const snap = await ref.get();
  return snap.data() as WeeklyPriority;
}

type WeeklyPriorityPatch = Partial<{
  title: string;
  weekStart: string; // if you allow moving it to a different week
  tag: string | null;
  level: string | null;
}>;

export async function updateWeeklyPriority(id: string, patch: WeeklyPriorityPatch) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const payload: Record<string, unknown> = {};

  if (typeof patch.title === "string") payload.title = patch.title.trim();
  if (typeof patch.weekStart === "string") payload.weekStart = patch.weekStart;
  if (patch.tag !== undefined) payload.tag = patch.tag === "" ? null : patch.tag?.trim() ?? null;
  if (patch.level !== undefined) payload.level = patch.level === "" ? null : patch.level?.trim() ?? null;

  if (Object.keys(payload).length === 0) throw new Error("No valid fields to update.");

  const ref = db.collection("users").doc(user.uid).collection(COL_PRIORITIES).doc(id);
  await ref.update({ ...payload, updatedAt: FieldValue.serverTimestamp() });

  const snap = await ref.get();
  return snap.data() as WeeklyPriority;
}

export async function deleteWeeklyPriority(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const userDoc = db.collection("users").doc(user.uid);
  const ref = userDoc.collection(COL_PRIORITIES).doc(id);

  const snap = await ref.get();
  if (!snap.exists) return { deleted: false };

  // OPTIONAL: clear references on tasks (uncomment if desired)
  // const weekStart = (snap.data() as any)?.weekStart as string | undefined;
  // if (weekStart) {
  //   const weekEnd = addDaysISO(weekStart, 6);
  //   const q = await userDoc
  //     .collection(COL_TASKS)
  //     .where("date", ">=", weekStart)
  //     .where("date", "<=", weekEnd)
  //     .where("weeklyPriorityId", "==", id) // only string-linked tasks
  //     .get();
  //   const batch = db.batch();
  //   q.docs.forEach((d) => batch.update(d.ref, { weeklyPriorityId: null }));
  //   await batch.commit();
  // }

  await ref.delete();
  return { deleted: true };
}
