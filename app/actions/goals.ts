import { getCurrentUser } from "@/lib/auth";
import { firestore } from "@/lib/firebase-client";
import type { Goal, Habit, HabitCompletion, GoalWithHabits } from "@/lib/types/goals";
import { userCol } from "@/lib/user-collection";
import { isHabitDue } from "@/lib/habit-schedule";
import { deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";

const COL_GOALS = "goals";
const COL_HABITS = "habits";
const COL_COMPLETIONS = "habit_completions";

type CreateGoalInput = {
  category: string;
  title: string;
  description?: string | null;
  targetDate?: string | null;
};

type HabitType = "checkbox" | "counter";
type AddHabitInput = {
  goalId: string;
  name: string;
  type?: HabitType;
  target?: number;
  scheduleMask?: string;
  verifyGoalExists?: boolean;
};

type GoalPatch = Partial<{
  category: string;
  title: string;
  description: string | null;
  targetDate: string | null;
}>;

export async function createGoal({ category, title, description, targetDate }: CreateGoalInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const id = crypto.randomUUID();

  const ref = doc(userCol(user.uid, COL_GOALS), id);

  const payload = {
    id,
    title: title.trim(),
    description: description ?? null,
    category: category ?? "",
    targetDate: targetDate ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload);

  const snap = await getDoc(ref);
  if (!snap.exists) {
    throw new Error("Goal creation failed (document missing after write).");
  }

  return snap.data() as Goal;
}

export async function updateGoal(id: string, patch: GoalPatch) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // --- sanitize / allowlist ---
  const payload: Record<string, unknown> = {};

  if (typeof patch.category === "string") {
    payload.category = patch.category.trim();
  }
  if (typeof patch.title === "string") {
    payload.title = patch.title.trim();
  }
  if (patch.description !== undefined) {
    const d = patch.description;
    payload.description = d === "" ? null : (d as string | null);
  }
  if (patch.targetDate !== undefined) {
    const t = patch.targetDate;
    payload.targetDate = t === "" ? null : (t as string | null);
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("No valid fields to update.");
  }

  const ref = doc(userCol(user.uid, COL_GOALS), id);
  await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });

  const snap = await getDoc(ref);
  if (!snap.exists) throw new Error("Goal not found after update.");
  return snap.data() as Goal;
}

export async function addHabit({ goalId, name, type = "checkbox", target = 1, scheduleMask = "MTWTF--", verifyGoalExists = true }: AddHabitInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const trimmedName = name?.trim();
  if (!trimmedName) throw new Error("Habit name is required.");

  if (typeof target !== "number" || !Number.isFinite(target) || target <= 0) {
    throw new Error("Target must be a positive number.");
  }

  if (typeof scheduleMask !== "string" || scheduleMask.length !== 7) {
    throw new Error("scheduleMask must be a 7-character string (e.g., 'MTWTF--').");
  }

  if (verifyGoalExists) {
    const goalRef = doc(userCol(user.uid, COL_GOALS), goalId);
    const goalSnap = await getDoc(goalRef);

    if (!goalSnap.exists) {
      throw new Error("Goal not found. Make sure goalId is a valid UUID.");
    }
  }

  const id = crypto.randomUUID();
  const ref = doc(userCol(user.uid, COL_HABITS), id);

  const payload = {
    id,
    name: trimmedName,
    goalId,
    type,
    target,
    scheduleMask,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload);

  const snap = await getDoc(ref);
  return snap.data() as Habit;
}

export async function deleteHabit(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const habitRef = doc(userCol(user.uid, COL_HABITS), id);
  const habitSnap = await getDoc(habitRef);

  if (!habitSnap.exists) {
    return { deletedHabit: false, deletedCompletions: 0 };
  }

  let deletedCompletions = 0;
  const pageSize = 450;

  while (true) {
    const q = query(userCol(user.uid, COL_COMPLETIONS), where("habitId", "==", id), limit(pageSize));
    const compsSnap = await getDocs(q);
    const page = compsSnap;

    if (page.empty) break;

    const batch = writeBatch(firestore);
    page.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    deletedCompletions += page.size;
  }

  await deleteDoc(habitRef);

  return { deletedHabit: true, deletedCompletions };
}

export async function toggleHabitCompletion(habitId: string, date: string, value = 1) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (!habitId) throw new Error("habitId is required.");
  if (typeof date !== "string" || date.length < 8) {
    throw new Error("date must be an ISO-like string, e.g., '2025-08-26'.");
  }
  if (!Number.isFinite(value)) throw new Error("value must be a finite number.");

  const completionId = `${habitId}:${date}`;
  const ref = doc(userCol(user.uid, COL_COMPLETIONS), completionId);

  const existingSnap = await getDoc(ref);
  const currentValue = existingSnap.exists() ? existingSnap.data().value ?? 0 : 0;
  const newValue = currentValue + value;

  if (newValue <= 0) {
    await deleteDoc(ref);
    return undefined;
  }

  const payload: Record<string, unknown> = {
    id: completionId,
    habitId,
    date,
    value: newValue,
    updatedAt: serverTimestamp(),
  };
  if (!existingSnap.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(ref, payload, { merge: true });

  const snap = await getDoc(ref);
  return snap.data() as HabitCompletion | undefined;
}

export async function getGoalsWithHabits(date: string): Promise<GoalWithHabits[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const [goalsSnap, habitsSnap, compsSnap] = await Promise.all([
    getDocs(userCol(user.uid, COL_GOALS)),
    getDocs(userCol(user.uid, COL_HABITS)),
    getDocs(query(userCol(user.uid, COL_COMPLETIONS), where("date", "==", date))),
  ]);

  const goals: Goal[] = goalsSnap.docs.map((d) => ({
    ...(d.data() as Goal),
  }));

  const habits: Habit[] = habitsSnap.docs.map((d) => ({
    ...(d.data() as Habit),
  }));

  const completions: HabitCompletion[] = compsSnap.docs.map((d) => ({
    ...(d.data() as HabitCompletion),
  }));

  const compsByHabit = new Map<string, Array<Pick<HabitCompletion, "date" | "value">>>();
  for (const c of completions) {
    const arr = compsByHabit.get(c.habitId) ?? [];
    arr.push({ date: c.date, value: c.value });
    compsByHabit.set(c.habitId, arr);
  }

  const habitsByGoal = new Map<string, Habit[]>();
  for (const h of habits) {
    const arr = habitsByGoal.get(h.goalId) ?? [];
    arr.push(h);
    habitsByGoal.set(h.goalId, arr);
  }

  const result: GoalWithHabits[] = goals.map((g) => {
    const hs = habitsByGoal.get(g.id) ?? [];
    const hsWithComps = hs.map((h) => {
      const completions = compsByHabit.get(h.id) ?? [];
      const todayVal = completions[0]?.value ?? 0;
      const dueToday = isHabitDue(h.scheduleMask, new Date(date)) && todayVal < h.target;
      return { ...h, completions, dueToday };
    });
    return { ...g, habits: hsWithComps };
  });

  // (Optional) sort goals/habits
  // result.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
  // result.forEach(g => g.habits.sort((a,b)=> (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0)));

  return result;
}

async function commitInChunks(refs: Array<ReturnType<typeof doc>>, chunkSize = 450) {
  for (let i = 0; i < refs.length; i += chunkSize) {
    const batch = writeBatch(firestore);
    refs.slice(i, i + chunkSize).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function deleteGoal(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const goalRef = doc(userCol(user.uid, COL_GOALS), id);
  const goalSnap = await getDoc(goalRef);

  if (!goalSnap.exists) {
    return { deletedGoal: false, deletedHabits: 0, deletedCompletions: 0 };
  }

  const habitsSnap = await getDocs(query(userCol(user.uid, COL_HABITS), where("goalId", "==", id)));

  const habitRefs = habitsSnap.docs.map((d) => d.ref);
  const habitIds = habitsSnap.docs.map((d) => d.id);

  let deletedCompletions = 0;

  for (const hid of habitIds) {
    while (true) {
      const q = query(userCol(user.uid, COL_COMPLETIONS), where("habitId", "==", hid), limit(450));
      const compsSnap = await getDocs(q);
      const page = compsSnap;

      if (page.empty) break;

      const batch = writeBatch(firestore);
      page.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deletedCompletions += page.size;
    }
  }

  await commitInChunks(habitRefs);

  await deleteDoc(goalRef);

  return {
    deletedGoal: true,
    deletedHabits: habitRefs.length,
    deletedCompletions,
  };
}
