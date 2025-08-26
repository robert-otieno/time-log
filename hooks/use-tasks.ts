import { useEffect, useState } from "react";

import { formatISODate } from "@/lib/date-utils";
import { toast } from "sonner";
import { addDailySubtask, addDailyTask, deleteDailySubtask, deleteDailyTask, getTodayTasks, TaskWithSubtasks, toggleDailySubtask, toggleDailyTask, updateDailyTask } from "@/app/actions/tasks";
import { getWeeklyPriorities } from "@/app/actions";

export type UITask = TaskWithSubtasks & { dueLabel?: string; hot?: boolean; count?: any; priority?: any };

export function useTasks(date: string) {
  const [tasks, setTasks] = useState<UITask[]>([]);
  const [weeklyPriorities, setWeeklyPriorities] = useState<{ id: string; title: string; level: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function loadTasks() {
    try {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const weekStart = formatISODate(monday);

      const [res, priorities] = await Promise.all([getTodayTasks(date), getWeeklyPriorities(weekStart)]);
      const now = Date.now();
      const withMeta = res.map((t) => {
        let dueLabel: string | undefined;
        let hot = false;
        if (t.deadline) {
          const deadline = new Date(t.deadline);
          dueLabel = deadline.toLocaleDateString([], { month: "short", day: "numeric" });
          const diff = deadline.getTime() - now;
          hot = diff > 0 && diff <= 24 * 60 * 60 * 1000 && !t.done;
        }
        return { ...t, dueLabel, hot } as UITask;
      });
      setTasks(withMeta);
      setWeeklyPriorities(priorities.map((p: any) => ({ id: p.id, title: p.title, level: p.level })));
      setError(null);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load tasks", err);
      setError("Failed to load tasks");
    }
  }

  async function addTask(title: string, tag: string, deadline: string, reminder: string, priority: string) {
    try {
      if (!title.trim()) return;
      const deadlineISO = deadline && deadline.length <= 5 && !deadline.includes("T") ? `${date}T${deadline}` : deadline || null;
      const reminderISO = reminder ? `${date}T${reminder}` : null;
      const priorityId = priority && priority !== "none" ? priority : undefined;
      const res = await addDailyTask({
        title,
        date,
        tag,
        deadline: deadlineISO,
        reminderTime: reminderISO,
        weeklyPriorityId: priorityId,
      });
      const id = res.id;
      const now = Date.now();
      let dueLabel: string | undefined;
      let hot = false;
      if (deadlineISO) {
        const d = new Date(deadlineISO);
        dueLabel = d.toLocaleDateString([], { month: "short", day: "numeric" });
        const diff = d.getTime() - now;
        hot = diff > 0 && diff <= 24 * 60 * 60 * 1000;
      }
      const priorityObj = priorityId ? weeklyPriorities.find((p) => p.id === priorityId) : undefined;
      setTasks((prev) => [
        ...prev,
        {
          id,
          title,
          date,
          tag,
          deadline: deadlineISO,
          reminderTime: reminderISO,
          weeklyPriorityId: priorityId,
          done: false,
          notes: null,
          link: null,
          fileRefs: null,
          subtasks: [],
          priority: priorityObj as any,
          dueLabel,
          hot,
        } as UITask,
      ]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add task");
    }
  }

  async function toggleTask(id: string, done: boolean) {
    try {
      await toggleDailyTask(id, !done);
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const newDone = !done;
          let hot = false;
          if (t.deadline) {
            const diff = new Date(t.deadline).getTime() - Date.now();
            hot = diff > 0 && diff <= 24 * 60 * 60 * 1000 && !newDone;
          }
          return { ...t, done: newDone, hot };
        })
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update task");
    }
  }

  async function deleteTask(id: string) {
    try {
      await deleteDailyTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete task");
    }
  }

  async function addSubtask(taskId: string, title: string) {
    if (!title?.trim()) return;
    try {
      const res = await addDailySubtask({ taskId, title });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, subtasks: [...t.subtasks, { id: res!.id, taskId, title, done: false }] } : t)));
    } catch (err: any) {
      console.error(err);
      toast.error("Error Adding Subtask", err);
    }
  }

  async function toggleSubtask(id: string, done: boolean) {
    try {
      await toggleDailySubtask(id, !done);
      setTasks((prev) =>
        prev.map((t) =>
          t.subtasks.some((s) => s.id === id)
            ? {
                ...t,
                subtasks: t.subtasks.map((s) => (s.id === id ? { ...s, done: !done } : s)),
              }
            : t
        )
      );
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to update subtask");
    }
  }

  async function deleteSubtask(id: string) {
    try {
      await deleteDailySubtask(id);
      setTasks((prev) => prev.map((t) => (t.subtasks.some((s) => s.id === id) ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== id) } : t)));
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to delete subtask");
    }
  }

  async function updateTask(id: string, values: { title: string; tag: string; deadline: string; reminder: string; priority: string }) {
    const deadlineISO = values.deadline && values.deadline.length <= 5 && !values.deadline.includes("T") ? `${date}T${values.deadline}` : values.deadline || null;
    const reminderISO = values.reminder ? `${date}T${values.reminder}` : null;
    const priorityId = values.priority && values.priority !== "none" ? values.priority : null;
    await updateDailyTask(id, {
      title: values.title,
      tag: values.tag,
      deadline: deadlineISO,
      reminderTime: reminderISO,
      weeklyPriorityId: priorityId,
    });
    const priorityObj = priorityId ? weeklyPriorities.find((p) => p.id === priorityId) : undefined;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        let dueLabel: string | undefined;
        let hot = false;
        if (deadlineISO) {
          const d = new Date(deadlineISO);
          dueLabel = d.toLocaleDateString([], { month: "short", day: "numeric" });
          const diff = d.getTime() - Date.now();
          hot = diff > 0 && diff <= 24 * 60 * 60 * 1000 && !t.done;
        }
        return {
          ...t,
          title: values.title,
          tag: values.tag,
          deadline: deadlineISO,
          reminderTime: reminderISO,
          weeklyPriorityId: priorityId ?? undefined,
          priority: priorityObj as any,
          dueLabel,
          hot,
        } as UITask;
      })
    );
  }

  return {
    tasks,
    weeklyPriorities,
    error,
    loadTasks,
    addTask,
    toggleTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    updateTask,
  };
}
