import { useEffect, useState } from "react";
import { addGoal, addHabit, deleteGoal, getGoalsWithHabits, toggleHabitCompletion, type GoalWithHabits } from "@/app/actions";
import { toast } from "sonner";

export function useGoals() {
  const [goals, setGoals] = useState<GoalWithHabits[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadGoals() {
    try {
      const res = await getGoalsWithHabits();
      setGoals(res);
      setError(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load goals");
      setError("Failed to load goals");
    }
  }

  async function addNewGoal(category: string, title: string, deadline?: string | null) {
    if (!category || !title.trim()) return;
    try {
      const res = await addGoal(category, title, deadline);
      const id = Number((res as any)?.lastInsertRowid ?? (res as any)?.insertId);
      setGoals((prev) => [...prev, { id, category, title, deadline: deadline ?? null, habits: [] }]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add goal");
    }
  }

  async function removeGoal(id: number) {
    try {
      await deleteGoal(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete goal");
    }
  }

  async function addNewHabit(goalId: number, name: string) {
    if (!name.trim()) return;
    try {
      const res = await addHabit(goalId, name);
      const id = Number((res as any)?.lastInsertRowid ?? (res as any)?.insertId);
      setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, habits: [...g.habits, { id, goalId, name, completions: [] }] } : g)));
    } catch (err) {
      console.error(err);
      toast.error("Failed to add habit");
    }
  }

  async function toggleHabit(habitId: number, date: string) {
    try {
      await toggleHabitCompletion(habitId, date);
      setGoals((prev) =>
        prev.map((g) => ({
          ...g,
          habits: g.habits.map((h) => {
            if (h.id !== habitId) return h;
            const done = h.completions.includes(date);
            return {
              ...h,
              completions: done ? h.completions.filter((d) => d !== date) : [...h.completions, date],
            };
          }),
        }))
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to toggle habit");
    }
  }

  return {
    goals,
    error,
    loadGoals,
    addGoal: addNewGoal,
    deleteGoal: removeGoal,
    addHabit: addNewHabit,
    toggleHabit,
  };
}

export type { GoalWithHabits };
