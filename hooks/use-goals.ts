import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatISODate } from "@/lib/date-utils";
import { isHabitDue } from "@/lib/habit-schedule";
import { addHabit, createGoal, deleteGoal, deleteHabit, getGoalsWithHabits, GoalWithHabits, toggleHabitCompletion } from "@/app/actions/goals";

export function useGoals() {
  const [goals, setGoals] = useState<GoalWithHabits[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadGoals() {
    try {
      const today = formatISODate(new Date());
      const res = await getGoalsWithHabits(today);
      setGoals(res);
      setError(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load goals");
      setError("Failed to load goals");
    }
  }

  async function addNewGoal(category: string, title: string, targetDate?: string | null) {
    if (!category || !title.trim()) return;
    try {
      const res = await createGoal({ category, title, targetDate });
      setGoals((prev) => [...prev, { ...res, habits: [] }]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add goal");
    }
  }

  async function removeGoal(id: string) {
    try {
      await deleteGoal(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete goal");
    }
  }

  async function addNewHabit(goalId: string, name: string) {
    if (!name.trim()) return;
    try {
      const res = await addHabit({ goalId, name });
      const dueToday = isHabitDue(res.scheduleMask, new Date());
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? {
                ...g,
                habits: [
                  ...g.habits,
                  {
                    ...res,
                    completions: [],
                    dueToday,
                  },
                ],
              }
            : g
        )
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to add habit");
    }
  }

  async function removeHabit(habitId: string) {
    try {
      await deleteHabit(habitId);
      setGoals((prev) => prev.map((g) => ({ ...g, habits: g.habits.filter((h) => h.id !== habitId) })));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete habit");
    }
  }

  async function toggleHabit(habitId: string, date: string, value = 1) {
    try {
      await toggleHabitCompletion(habitId, date, value);
      setGoals((prev) =>
        prev.map((g) => ({
          ...g,
          habits: g.habits.map((h) => {
            if (h.id !== habitId) return h;
            const existing = h.completions.find((c) => c.date === date);
            let newCompletions;
            if (h.type === "checkbox") {
              newCompletions = existing ? h.completions.filter((c) => c.date !== date) : [...h.completions, { date, value: 1 }];
            } else {
              if (existing) {
                newCompletions = h.completions.map((c) => (c.date === date ? { date, value: c.value + value } : c));
              } else {
                newCompletions = [...h.completions, { date, value }];
              }
            }
            const today = formatISODate(new Date());
            const todayVal = newCompletions.find((c) => c.date === today)?.value ?? 0;
            const dueToday = isHabitDue(h.scheduleMask, new Date()) && todayVal < h.target;
            return { ...h, completions: newCompletions, dueToday };
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
    deleteHabit: removeHabit,
    toggleHabit,
  };
}

export type { GoalWithHabits };
