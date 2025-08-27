export type Goal = {
  id: string;
  title: string;
  category?: string;
  description?: string | null;
  targetDate?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type Habit = {
  id: string;
  goalId: string;
  name: string;
  type: "checkbox" | "counter";
  target: number;
  scheduleMask: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type HabitCompletion = {
  id: string;
  habitId: string;
  date: string;
  value: number;
};

export type GoalWithHabits = Goal & {
  habits: Array<
    Habit & {
      completions: Array<Pick<HabitCompletion, "date" | "value">>;
    }
  >;
};
