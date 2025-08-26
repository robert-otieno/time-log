import { adminDb } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { FieldValue } from "firebase-admin/firestore";

type CreateGoalInput = {
  category: string;
  title: string;
  description?: string | null;
  targetDate?: string | null;
};

export async function createGoal({ category, title, description, targetDate }: CreateGoalInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const id = crypto.randomUUID();

  const ref = adminDb.collection("users").doc(user.uid).collection("goals").doc(id);

  const payload = {
    id,
    title: title.trim(),
    description: description ?? null,
    category: category ?? "",
    targetDate: targetDate ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    // any defaults you use elsewhere:
    // status: "active",
    // progress: 0,
    // tags: [],
  };

  await ref.set(payload);

  // Read back once to materialize server timestamps
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Goal creation failed (document missing after write).");
  }

  // Return the created doc data (typed as you need in your app)
  return snap.data();
}

type GoalPatch = Partial<{
  category: string;
  title: string;
  description: string | null; // allow null to clear
  targetDate: string | null; // ISO string or null to clear
}>;

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

  const ref = adminDb.collection("users").doc(user.uid).collection("goals").doc(id);

  await ref.update({
    ...payload,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const snap = await ref.get();
  if (!snap.exists) throw new Error("Goal not found after update.");
  return snap.data();
}

const COL_HABITS = "habits"; // or "rhythm_tasks" — keep this consistent everywhere

type HabitType = "checkbox" | "counter"; // extend if you support more
type AddHabitInput = {
  goalId: string; // UUID from createGoal
  name: string;
  type?: HabitType; // default: "checkbox"
  target?: number; // default: 1
  scheduleMask?: string; // default: "MTWTF--"
  verifyGoalExists?: boolean; // default: true
};

export async function addHabit({ goalId, name, type = "checkbox", target = 1, scheduleMask = "MTWTF--", verifyGoalExists = true }: AddHabitInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // --- basic validation / normalization ---
  const trimmedName = name?.trim();
  if (!trimmedName) throw new Error("Habit name is required.");

  if (typeof target !== "number" || !Number.isFinite(target) || target <= 0) {
    throw new Error("Target must be a positive number.");
  }

  // very light mask check: 7 chars (Mon..Sun)
  if (typeof scheduleMask !== "string" || scheduleMask.length !== 7) {
    throw new Error("scheduleMask must be a 7-character string (e.g., 'MTWTF--').");
  }

  // ensure the referenced goal exists (helps prevent orphans)
  if (verifyGoalExists) {
    const goalRef = adminDb.collection("users").doc(user.uid).collection("goals").doc(goalId);
    const goalSnap = await goalRef.get();
    if (!goalSnap.exists) {
      throw new Error("Goal not found. Make sure goalId is a valid UUID.");
    }
  }

  const id = crypto.randomUUID();
  const ref = adminDb.collection("users").doc(user.uid).collection(COL_HABITS).doc(id);

  const payload = {
    id,
    name: trimmedName,
    goalId, // keep as string UUID to match createGoal
    type,
    target,
    scheduleMask,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(payload);

  // Optional: read back to materialize server timestamps
  const snap = await ref.get();
  return snap.data()!;
}

const COL_COMPLETIONS = "habit_completions";

/**
 * Delete a habit and all of its completion documents.
 * - Batches deletions to respect Firestore limits (≤500 ops per batch)
 * - Returns the number of completion docs removed
 */
export async function deleteHabit(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const habitRef = adminDb.collection("users").doc(user.uid).collection(COL_HABITS).doc(id);

  // Early exit if habit doesn’t exist (idempotent behavior)
  const habitSnap = await habitRef.get();
  if (!habitSnap.exists) {
    return { deletedHabit: false, deletedCompletions: 0 };
  }

  const completionsCol = adminDb.collection("users").doc(user.uid).collection(COL_COMPLETIONS);

  let deletedCompletions = 0;

  // Delete completions in pages to avoid >500 batch limit
  // Adjust pageSize if needed (keep some headroom)
  const pageSize = 450;

  while (true) {
    const page = await completionsCol.where("habitId", "==", id).limit(pageSize).get();

    if (page.empty) break;

    const batch = adminDb.batch();
    page.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    deletedCompletions += page.size;
    // Loop again in case there are more than one page
  }

  // Finally delete the habit document itself
  await habitRef.delete();

  return { deletedHabit: true, deletedCompletions };
}

/**
 * Toggle or set a habit completion value for a given date.
 * - Idempotent: one doc per (habitId, date) via deterministic ID.
 * - Creates if missing, updates if exists.
 */
export async function toggleHabitCompletion(habitId: string, date: string, value = 1) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // basic validation
  if (!habitId) throw new Error("habitId is required.");
  if (typeof date !== "string" || date.length < 8) {
    throw new Error("date must be an ISO-like string, e.g., '2025-08-26'.");
  }
  if (!Number.isFinite(value)) throw new Error("value must be a finite number.");

  // Stable doc id prevents duplicates for the same (habitId, date)
  const completionId = `${habitId}:${date}`;

  const ref = adminDb.collection("users").doc(user.uid).collection(COL_COMPLETIONS).doc(completionId);

  // Use set(..., {merge:true}) to upsert and keep createdAt if present
  await ref.set(
    {
      id: completionId,
      habitId,
      date,
      value,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const snap = await ref.get();
  return snap.data();
}

type Goal = {
  id: string; // UUID
  title: string;
  category?: string;
  description?: string | null;
  targetDate?: string | null; // keep string unless you store Timestamps
  createdAt?: FirebaseFirestore.Timestamp | null;
  updatedAt?: FirebaseFirestore.Timestamp | null;
};

type Habit = {
  id: string; // UUID
  goalId: string; // UUID (matches Goal.id)
  name: string;
  type: "checkbox" | "counter";
  target: number;
  scheduleMask: string; // e.g., "MTWTF--"
  createdAt?: FirebaseFirestore.Timestamp | null;
  updatedAt?: FirebaseFirestore.Timestamp | null;
};

type HabitCompletion = {
  id: string; // `${habitId}:${YYYY-MM-DD}`
  habitId: string; // UUID
  date: string; // "YYYY-MM-DD"
  value: number; // 0/1 for checkbox; counts for counter
};

export type GoalWithHabits = Goal & {
  habits: Array<
    Habit & {
      completions: Array<Pick<HabitCompletion, "date" | "value">>;
    }
  >;
};

export async function getGoalsWithHabits(date: string): Promise<GoalWithHabits[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const userDoc = adminDb.collection("users").doc(user.uid);

  // 1) Fetch data in parallel
  const [goalsSnap, habitsSnap, compsSnap] = await Promise.all([
    userDoc.collection("goals").get(),
    userDoc.collection("habits").get(), // <- use "habits" consistently
    userDoc.collection("habit_completions").where("date", "==", date).get(),
  ]);

  // 2) Normalize
  const goals: Goal[] = goalsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  const habits: Habit[] = habitsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  const completions: HabitCompletion[] = compsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  // 3) Index completions by habitId for O(1) lookup
  const compsByHabit = new Map<string, Array<Pick<HabitCompletion, "date" | "value">>>();
  for (const c of completions) {
    const arr = compsByHabit.get(c.habitId) ?? [];
    arr.push({ date: c.date, value: c.value });
    compsByHabit.set(c.habitId, arr);
  }

  // 4) Index habits by goalId
  const habitsByGoal = new Map<string, Habit[]>();
  for (const h of habits) {
    const arr = habitsByGoal.get(h.goalId) ?? [];
    arr.push(h);
    habitsByGoal.set(h.goalId, arr);
  }

  // 5) Assemble final structure
  const result: GoalWithHabits[] = goals.map((g) => {
    const hs = habitsByGoal.get(g.id) ?? [];
    const hsWithComps = hs.map((h) => ({
      ...h,
      completions: compsByHabit.get(h.id) ?? [],
    }));
    return { ...g, habits: hsWithComps };
  });

  // (Optional) sort goals/habits
  // result.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
  // result.forEach(g => g.habits.sort((a,b)=> (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0)));

  return result;
}

const COL_GOALS = "goals";

// Batch helper
async function commitInChunks(refs: FirebaseFirestore.DocumentReference[], chunkSize = 450) {
  for (let i = 0; i < refs.length; i += chunkSize) {
    const batch = adminDb.batch();
    refs.slice(i, i + chunkSize).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/** Delete a goal, all its habits, and their completions (Admin SDK, UUID-safe). */
export async function deleteGoal(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const userDoc = adminDb.collection("users").doc(user.uid);
  const goalRef = userDoc.collection(COL_GOALS).doc(id);

  // 0) If goal doesn't exist, be idempotent
  const goalSnap = await goalRef.get();
  if (!goalSnap.exists) {
    return { deletedGoal: false, deletedHabits: 0, deletedCompletions: 0 };
  }

  // 1) Fetch habits for this goal
  const habitsSnap = await userDoc.collection(COL_HABITS).where("goalId", "==", id).get();

  const habitRefs = habitsSnap.docs.map((d) => d.ref);
  const habitIds = habitsSnap.docs.map((d) => d.id);

  // 2) Delete completions for those habits (page to avoid limit)
  let deletedCompletions = 0;

  for (const hid of habitIds) {
    while (true) {
      const page = await userDoc.collection(COL_COMPLETIONS).where("habitId", "==", hid).limit(450).get();

      if (page.empty) break;

      const batch = adminDb.batch();
      page.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deletedCompletions += page.size;
    }
  }

  // 3) Delete habits (batched)
  await commitInChunks(habitRefs);

  // 4) Delete the goal itself
  await goalRef.delete();

  return {
    deletedGoal: true,
    deletedHabits: habitRefs.length,
    deletedCompletions,
  };
}
