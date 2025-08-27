import { getCurrentUser } from "@/lib/auth";
import { firestore } from "@/lib/firebase-client";
import { DailySubtask, DailyTask, TaskWithSubtasks, WeeklyPriority } from "@/lib/types/tasks";
import { userCol } from "@/lib/user-collection";
import { deleteDoc, doc, documentId, FieldValue, getDoc, getDocs, limit, query, serverTimestamp, setDoc, Timestamp, where, writeBatch } from "firebase/firestore";

const COL_TASKS = "daily_tasks";
const COL_SUBTASKS = "daily_subtasks";
const COL_PRIORITIES = "weekly_priorities";

const chunk = <T>(arr: T[], size = 10): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

export async function getTodayTasks(date: string): Promise<TaskWithSubtasks[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const tasksSnap = await getDocs(query(userCol(user.uid, "daily_tasks"), where("date", "==", date)));

  const tasks: DailyTask[] = tasksSnap.docs.map((d) => ({
    ...(d.data() as DailyTask),
  }));
  if (tasks.length === 0) return [];

  const taskIds = tasks.map((t) => t.id);

  let subtasks: DailySubtask[] = [];
  for (const ids of chunk(taskIds, 10)) {
    const subSnap = await getDocs(query(userCol(user.uid, COL_SUBTASKS), where("taskId", "in", ids)));

    subtasks.push(
      ...subSnap.docs.map((d) => ({
        ...(d.data() as DailySubtask),
      }))
    );
  }

  const priorityIds = Array.from(new Set(tasks.map((t) => t.weeklyPriorityId).filter((v): v is string => typeof v === "string" && v.length > 0)));

  const prioritiesById = new Map<string, WeeklyPriority>();
  for (const ids of chunk(priorityIds, 10)) {
    const priSnap = await getDocs(query(userCol(user.uid, COL_PRIORITIES), where(documentId(), "in", ids)));
    priSnap.docs.forEach((doc) => {
      prioritiesById.set(doc.id, { ...(doc.data() as WeeklyPriority) });
    });
  }

  return tasks.map((t) => ({
    ...t,
    subtasks: subtasks.filter((s) => s.taskId === t.id),
    priority: t.weeklyPriorityId ? prioritiesById.get(t.weeklyPriorityId) : undefined,
  }));
}

export async function getTaskDates(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const snap = await getDocs(userCol(user.uid, COL_TASKS));
  const dates = Array.from(new Set(snap.docs.map((d) => (d.data() as DailyTask).date)));
  return dates.sort().reverse();
}

type AddDailyTaskInput = {
  title: string;
  date: string;
  tag?: string;
  deadline?: string | null;
  reminderTime?: string | null;
  weeklyPriorityId?: string | null;
  notes?: string | null;
  link?: string | null;
  fileRefs?: string | null;
};

export async function addDailyTask(input: AddDailyTaskInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const id = crypto.randomUUID();
  const ref = doc(userCol(user.uid, COL_TASKS), id);

  const weeklyPriorityId = input.weeklyPriorityId ?? null;

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
    createdAt: serverTimestamp() as FieldValue,
    updatedAt: serverTimestamp() as FieldValue,
  };

  await setDoc(ref, payload);
  const snap = await getDoc(ref);
  return snap.data() as DailyTask;
}

export async function toggleDailyTask(id: string, done: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const ref = doc(userCol(user.uid, COL_TASKS), id);
  await setDoc(ref, { done, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteDailyTask(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const taskRef = doc(userCol(user.uid, COL_TASKS), id);
  const taskSnap = await getDoc(taskRef);

  if (!taskSnap.exists) return { deletedTask: false, deletedSubtasks: 0 };

  let deletedSubtasks = 0;
  const pageSize = 450;

  while (true) {
    const q = query(userCol(user.uid, COL_SUBTASKS), where("taskId", "==", id), limit(pageSize));
    const page = await getDocs(q);

    if (page.empty) break;

    const batch = writeBatch(firestore);
    page.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deletedSubtasks += page.size;
  }

  await deleteDoc(taskRef);

  return { deletedTask: true, deletedSubtasks };
}

type AddDailySubtaskInput = {
  taskId: string;
  title: string;
};

export async function addDailySubtask({ taskId, title }: AddDailySubtaskInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const trimmed = title?.trim();
  if (!trimmed) throw new Error("Subtask title is required.");

  const parentRef = doc(userCol(user.uid, COL_TASKS), taskId);
  const parentSnap = await getDoc(parentRef);
  if (!parentSnap.exists) throw new Error("Parent task not found.");

  const id = crypto.randomUUID();
  const ref = doc(userCol(user.uid, COL_SUBTASKS), id);

  const payload = {
    id,
    taskId,
    title: trimmed,
    done: false,
    createdAt: serverTimestamp() as FieldValue,
    updatedAt: serverTimestamp() as FieldValue,
  };

  await setDoc(ref, payload);
  const snap = await getDoc(ref);
  return snap.data() as DailySubtask;
}

export async function toggleDailySubtask(id: string, done: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const ref = doc(userCol(user.uid, COL_SUBTASKS), id);
  await setDoc(ref, { done, updatedAt: serverTimestamp() }, { merge: true });
}

type DailyTaskPatch = Partial<{
  title: string;
  tag: string;
  date: string;
  deadline: string | null;
  reminderTime: string | null;
  weeklyPriorityId: string | number | null;
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
    payload.weeklyPriorityId = patch.weeklyPriorityId ?? null;
  }

  if (typeof patch.done === "boolean") payload.done = patch.done;

  if (Object.keys(payload).length === 0) throw new Error("No valid fields to update.");

  const ref = doc(userCol(user.uid, COL_TASKS), id);
  await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });

  const snap = await getDoc(ref);
  return snap.data() as DailyTask;
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

  const ref = doc(userCol(user.uid, COL_TASKS), id);
  await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });

  const snap = await getDoc(ref);
  return snap.data() as DailyTask;
}

export async function deleteDailySubtask(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const ref = doc(userCol(user.uid, COL_SUBTASKS), id);
  const snap = await getDoc(ref);

  if (!snap.exists) return { deleted: false };

  await deleteDoc(ref);
  return { deleted: true };
}
