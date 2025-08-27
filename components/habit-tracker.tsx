"use client";

import { useSelectedDate } from "@/hooks/use-selected-date";
import { formatISODate } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Habit, HabitCompletion } from "@/lib/types/goals";

type HabitWithCompletions = Habit & {
  completions: HabitCompletion[];
  dueToday: boolean;
};

interface HabitTrackerProps {
  habit: HabitWithCompletions;
  onToggle: (habitId: string, date: string, value?: number) => void;
  days?: number;
}

export default function HabitTracker({ habit, onToggle, days = 7 }: HabitTrackerProps) {
  const { selectedDate } = useSelectedDate();
  const today = formatISODate(new Date());

  const dates = Array.from({ length: days }, (_, idx) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - (days - 1 - idx));
    return formatISODate(d);
  });

  const completionMap = new Map(habit.completions.map((c) => [c.date, c.value]));
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - i);
    const formatted = formatISODate(d);
    const val = completionMap.get(formatted) ?? 0;
    if (val < habit.target) break;
    streak++;
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1 text-sm">
        {habit.name}
        <Badge variant="secondary">🔥{streak}</Badge>
      </span>
      {habit.type === "checkbox" ? (
        <ol className="grid grid-cols-7 gap-1">
          {dates.map((date) => {
            const val = completionMap.get(date) ?? 0;
            const due = date === today && habit.dueToday;
            return (
              <li key={date}>
                <button
                  type="button"
                  aria-label={val >= habit.target ? `Completed ${habit.name} on ${date}` : `Not completed ${habit.name} on ${date}`}
                  aria-pressed={val >= habit.target}
                  onClick={() => onToggle(habit.id, date)}
                  className={cn("h-3 w-3 rounded-full border", val >= habit.target && "bg-primary", due && val < habit.target && "animate-pulse border-primary")}
                />
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {dates.map((date) => {
            const val = completionMap.get(date) ?? 0;
            const due = date === today && habit.dueToday;
            let display = `${val}/${habit.target}`;
            // if (habit.type === "timer") display = `${val}m/${habit.target}m`;
            // if (habit.type === "pomodoro") display = `🍅${val}/${habit.target}`;
            return (
              <Button key={date} variant="outline" size="sm" className={cn("h-6", due && val < habit.target ? "animate-pulse" : "")} onClick={() => onToggle(habit.id, date, 1)}>
                {display}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
