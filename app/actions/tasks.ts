"use server";

import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { FieldPath, FieldValue } from "firebase-admin/firestore";

type WeeklyPriority = {
  id?: string;
  title: string;
  weekStart: string;
  tag?: string | null;
  level?: number | null;
};

type DailyTask = {
  id: string;
  title: string;
  date: string;
  tag: string;
  deadline?: string | null;
  reminderTime?: string | null;
  notes?: string | null;
  link?: string | null;
  fileRefs?: string | null;
  weeklyPriorityId?: string | number | null;
  done: boolean;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
};

type DailySubtask = {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
};

export type TaskWithSubtasks = DailyTask & {
  subtasks: DailySubtask[];
  priority?: WeeklyPriority;
};

const COL_TASKS = "daily_tasks";
const COL_SUBTASKS = "daily_subtasks";
const COL_PRIORITIES = "weekly_priorities";

const chunk = <T>(arr: T[], size = 10): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

export async function getTodayTasks(date: string): Promise<TaskWithSubtasks[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const userDoc = db.collection("users").doc(user.uid);

  // 1) Tasks for the day (order by createdAt if you like)
  const tasksSnap = await userDoc.collection(COL_TASKS).where("date", "==", date).get();

  const tasks: DailyTask[] = tasksSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  if (tasks.length === 0) return [];

  const taskIds = tasks.map((t) => t.id);

  // 2) Subtasks (batched 'in' queries)
  let subtasks: DailySubtask[] = [];
  for (const ids of chunk(taskIds, 10)) {
    const subSnap = await userDoc.collection(COL_SUBTASKS).where("taskId", "in", ids).get();

    subtasks.push(
      ...subSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }))
    );
  }

  // 3) Weekly Priorities (recommended: store weeklyPriorityId as the PRIORITY DOC ID)
  //    We'll do a best-effort: first try to collect string doc IDs; if you still have numeric legacy values,
  //    we also build a lookup by numeric 'id' field.
  const rawPriIds = Array.from(new Set(tasks.map((t) => t.weeklyPriorityId).filter((v): v is string | number => v !== undefined && v !== null)));

  const stringPriIds = rawPriIds.filter((v): v is string => typeof v === "string");
  const numberPriIds = rawPriIds.filter((v): v is number => typeof v === "number");

  // Lookup maps
  const prioritiesByDocId = new Map<string, WeeklyPriority>();
  const prioritiesByNumericId = new Map<number, WeeklyPriority>();

  // 3a) Fetch by documentId() for string IDs (fast & canonical)
  for (const ids of chunk(stringPriIds, 10)) {
    const priSnap = await userDoc.collection(COL_PRIORITIES).where(FieldPath.documentId(), "in", ids).get();

    priSnap.docs.forEach((doc) => {
      const data = { id: doc.id, ...(doc.data() as any) } as WeeklyPriority;
      prioritiesByDocId.set(doc.id, data);
    });
  }

  // 3b) Legacy path: fetch by numeric `id` field if you still have those
  for (const ids of chunk(numberPriIds, 10)) {
    const priSnap = await userDoc
      .collection(COL_PRIORITIES)
      .where("id", "in", ids) // requires that your weekly_priorities docs have a numeric 'id' field stored
      .get();

    priSnap.docs.forEach((doc) => {
      const data = { id: doc.id, ...(doc.data() as any) } as WeeklyPriority & { id?: string };
      const n = (doc.data() as any).id as number | undefined;
      if (typeof n === "number") prioritiesByNumericId.set(n, data);
    });
  }

  // 4) Assemble (O(1) lookups)
  return tasks.map((t) => {
    const st = subtasks.filter((s) => s.taskId === t.id);
    let priority: WeeklyPriority | undefined;

    if (typeof t.weeklyPriorityId === "string") {
      priority = prioritiesByDocId.get(t.weeklyPriorityId);
    } else if (typeof t.weeklyPriorityId === "number") {
      priority = prioritiesByNumericId.get(t.weeklyPriorityId);
    }

    return {
      ...t,
      subtasks: st,
      priority,
    };
  });
}

export async function getTaskDates(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const userDoc = db.collection("users").doc(user.uid);

  // Pull only tasks' dates; Firestore doesn't support 'distinct' server-side,
  // so we dedupe client-side. Ordering helps us emit latest-first.
  const snap = await userDoc.collection("daily_tasks").orderBy("date", "desc").get();

  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of snap.docs) {
    const date = (d.data() as any).date as string | undefined;
    if (date && !seen.has(date)) {
      seen.add(date);
      out.push(date);
    }
  }
  return out; // already latest-first due to orderBy("date","desc")
}

type AddDailyTaskInput = {
  title: string;
  date: string; // "YYYY-MM-DD"
  tag?: string;
  deadline?: string | null;
  reminderTime?: string | null;
  weeklyPriorityId?: string | number | null; // accept legacy numeric for now
  notes?: string | null;
  link?: string | null;
  fileRefs?: string | null;
};

export async function addDailyTask(input: AddDailyTaskInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const id = crypto.randomUUID();
  const ref = db.collection("users").doc(user.uid).collection(COL_TASKS).doc(id);

  const weeklyPriorityId =
    input.weeklyPriorityId === undefined || input.weeklyPriorityId === null
      ? null
      : typeof input.weeklyPriorityId === "number"
      ? input.weeklyPriorityId // legacy numeric kept as-is for now
      : String(input.weeklyPriorityId); // string doc id

  const payload: DailyTask = {
    id,
    title: input.title.trim(),
    date: input.date,
    tag: (input.tag ?? "work").trim(),
    deadline: input.deadline ?? null,
    reminderTime: input.reminderTime ?? null,
    notes: input.notes ?? null,
    link: input.link ?? null,
    fileRefs: input.fileRefs ?? null,
    weeklyPriorityId,
    done: false,
    createdAt: FieldValue.serverTimestamp() as any,
    updatedAt: FieldValue.serverTimestamp() as any,
  };

  await ref.set(payload);
  const snap = await ref.get();
  return snap.data() as DailyTask;
}

export async function toggleDailyTask(id: string, done: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const ref = db.collection("users").doc(user.uid).collection(COL_TASKS).doc(id);
  await ref.update({ done, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteDailyTask(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const userDoc = db.collection("users").doc(user.uid);
  const taskRef = userDoc.collection(COL_TASKS).doc(id);

  // Idempotent: if task doesn't exist, just exit cleanly
  const taskSnap = await taskRef.get();
  if (!taskSnap.exists) return { deletedTask: false, deletedSubtasks: 0 };

  // Page through subtasks by FK (taskId = parent task doc id)
  let deletedSubtasks = 0;
  const pageSize = 450;

  while (true) {
    const page = await userDoc.collection(COL_SUBTASKS).where("taskId", "==", id).limit(pageSize).get();

    if (page.empty) break;

    const batch = db.batch();
    page.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deletedSubtasks += page.size;
  }

  // Delete the task last
  await taskRef.delete();

  return { deletedTask: true, deletedSubtasks };
}

type AddDailySubtaskInput = {
  taskId: string; // parent task's DOC ID (UUID)
  title: string;
};

export async function addDailySubtask({ taskId, title }: AddDailySubtaskInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const trimmed = title?.trim();
  if (!trimmed) throw new Error("Subtask title is required.");

  // (Optional) verify parent exists to avoid orphans
  const parentRef = db.collection("users").doc(user.uid).collection(COL_TASKS).doc(taskId);
  const parentSnap = await parentRef.get();
  if (!parentSnap.exists) throw new Error("Parent task not found.");

  const id = crypto.randomUUID();
  const ref = db.collection("users").doc(user.uid).collection(COL_SUBTASKS).doc(id);

  const payload = {
    id,
    taskId, // FK = parent task doc id
    title: trimmed,
    done: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(payload);
  const snap = await ref.get();
  return snap.data();
}

export async function toggleDailySubtask(id: string, done: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const ref = db.collection("users").doc(user.uid).collection(COL_SUBTASKS).doc(id);
  await ref.update({ done, updatedAt: FieldValue.serverTimestamp() });
}

// Update only the fields you actually support mutating here.
// Add more keys as your UI needs them (e.g., tag, date, deadline, reminderTime, weeklyPriorityId).
type DailyTaskPatch = Partial<{
  title: string;
  tag: string;
  date: string; // "YYYY-MM-DD"
  deadline: string | null; // "" becomes null
  reminderTime: string | null; // "" becomes null
  weeklyPriorityId: string | number | null; // supports legacy numeric
  done: boolean;
}>;

export async function updateDailyTask(id: string, patch: DailyTaskPatch) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const payload: Record<string, unknown> = {};

  if (typeof patch.title === "string") payload.title = patch.title.trim();
  if (typeof patch.tag === "string") payload.tag = patch.tag.trim();
  if (typeof patch.date === "string") payload.date = patch.date;

  if (patch.deadline !== undefined) payload.deadline = patch.deadline === "" ? null : patch.deadline;
  if (patch.reminderTime !== undefined) payload.reminderTime = patch.reminderTime === "" ? null : patch.reminderTime;

  if (patch.weeklyPriorityId !== undefined) {
    payload.weeklyPriorityId =
      patch.weeklyPriorityId === null
        ? null
        : typeof patch.weeklyPriorityId === "number"
        ? patch.weeklyPriorityId // legacy numeric still accepted
        : String(patch.weeklyPriorityId);
  }

  if (typeof patch.done === "boolean") payload.done = patch.done;

  if (Object.keys(payload).length === 0) throw new Error("No valid fields to update.");

  const ref = db.collection("users").doc(user.uid).collection(COL_TASKS).doc(id);
  await ref.update({ ...payload, updatedAt: FieldValue.serverTimestamp() });

  const snap = await ref.get();
  return snap.data();
}

type TaskDetailsPatch = {
  notes?: string | null; // "" -> null
  link?: string | null; // "" -> null
  fileRefs?: string | null; // "" -> null
};

export async function updateTaskDetails(id: string, patch: TaskDetailsPatch) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const payload: Record<string, unknown> = {};
  if (patch.notes !== undefined) payload.notes = patch.notes === "" ? null : patch.notes;
  if (patch.link !== undefined) payload.link = patch.link === "" ? null : patch.link;
  if (patch.fileRefs !== undefined) payload.fileRefs = patch.fileRefs === "" ? null : patch.fileRefs;

  if (Object.keys(payload).length === 0) throw new Error("No valid fields to update.");

  const ref = db.collection("users").doc(user.uid).collection(COL_TASKS).doc(id);
  await ref.update({ ...payload, updatedAt: FieldValue.serverTimestamp() });

  const snap = await ref.get();
  return snap.data();
}

export async function deleteDailySubtask(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const ref = db.collection("users").doc(user.uid).collection(COL_SUBTASKS).doc(id);

  // Idempotent behavior: ignore if already gone
  const snap = await ref.get();
  if (!snap.exists) return { deleted: false };

  await ref.delete();
  return { deleted: true };
}
