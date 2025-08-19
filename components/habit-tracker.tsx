"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { HabitWithCompletions } from "@/app/actions";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { formatISODate } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface HabitTrackerProps {
  habit: HabitWithCompletions;
  onToggle: (habitId: number, date: string, value?: number) => void;
  days?: number;
}

export default function HabitTracker({ habit, onToggle, days = 7 }: HabitTrackerProps) {
  const { selectedDate } = useSelectedDate();

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
    <div className="grid grid-cols-8 items-center gap-1">
      <span className="flex items-center gap-1 text-sm">
        {habit.name}
        <Badge variant="secondary">🔥{streak}</Badge>
      </span>
      {dates.map((date) => {
        const val = completionMap.get(date) ?? 0;
        if (habit.type === "checkbox") {
          return <Checkbox key={date} aria-label={date} checked={val >= habit.target} onCheckedChange={() => onToggle(habit.id, date)} />;
        }
        let display = `${val}/${habit.target}`;
        if (habit.type === "timer") display = `${val}m/${habit.target}m`;
        if (habit.type === "pomodoro") display = `🍅${val}/${habit.target}`;
        return (
          <Button key={date} variant="outline" size="sm" className="h-6" onClick={() => onToggle(habit.id, date, 1)}>
            {display}
          </Button>
        );
      })}
    </div>
  );
}
