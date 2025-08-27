import { getCurrentUser } from "@/lib/auth";
import { DailyTask, WeeklyPriority } from "@/lib/types/tasks";
import { userCol } from "@/lib/user-collection";
import { deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";

type WeeklyPriorityPatch = Partial<{
  title: string;
  weekStart: string;
  tag: string | null;
  level: string | null;
}>;

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

  const priQ = query(userCol(user.uid, COL_PRIORITIES), where("weekStart", "==", weekStart));
  const priSnap = await getDocs(priQ);

  const priorities: WeeklyPriority[] = priSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  if (priorities.length === 0) return [];

  const weekEnd = addDaysISO(weekStart, 6);
  const tasksQ = query(userCol(user.uid, COL_TASKS), where("date", ">=", weekStart), where("date", "<=", weekEnd));
  const tasksSnap = await getDocs(tasksQ);

  const tasks: DailyTask[] = tasksSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

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

export async function addWeeklyPriority(title: string, weekStart: string, tag: string, level: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const id = crypto.randomUUID();
  const ref = doc(userCol(user.uid, COL_PRIORITIES), id);

  const payload = {
    id,
    title: title.trim(),
    weekStart,
    tag: tag?.trim() ?? null,
    level: level?.trim() ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload);
  return payload;
}

export async function updateWeeklyPriority(id: string, patch: WeeklyPriorityPatch) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const payload: Record<string, unknown> = {};

  if (typeof patch.title === "string") payload.title = patch.title.trim();
  if (typeof patch.weekStart === "string") payload.weekStart = patch.weekStart;
  if (patch.tag !== undefined) payload.tag = patch.tag === "" ? null : patch.tag?.trim() ?? null;
  if (patch.level !== undefined) payload.level = patch.level === "" ? null : patch.level?.trim() ?? null;

  if (Object.keys(payload).length === 0) throw new Error("No valid fields to update.");

  const ref = doc(userCol(user.uid, COL_PRIORITIES), id);
  await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });

  const snap = await getDoc(ref);
  return snap.data() as WeeklyPriority;
}

export async function deleteWeeklyPriority(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const ref = doc(userCol(user.uid, COL_PRIORITIES), id);

  // const snap = await ref.get();
  const snap = await getDoc(ref);
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

  await deleteDoc(ref);
  return { deleted: true };
}
