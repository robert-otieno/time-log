"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { HabitWithCompletions } from "@/app/actions";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { formatISODate } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";

interface HabitTrackerProps {
  habit: HabitWithCompletions;
  onToggle: (habitId: number, date: string) => void;
  days?: number;
}

export default function HabitTracker({ habit, onToggle, days = 7 }: HabitTrackerProps) {
  const { selectedDate } = useSelectedDate();

  const dates = Array.from({ length: days }, (_, idx) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - (days - 1 - idx));
    return formatISODate(d);
  });

  const completions = new Set(habit.completions);
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - i);
    const formatted = formatISODate(d);
    if (!completions.has(formatted)) break;
    streak++;
  }

  return (
    <div className="grid grid-cols-8 items-center gap-1">
      <span className="flex items-center gap-1 text-sm">
        {habit.name}
        <Badge variant="secondary">🔥{streak}</Badge>
      </span>
      {dates.map((date) => (
        <Checkbox key={date} aria-label={date} checked={habit.completions.includes(date)} onCheckedChange={() => onToggle(habit.id, date)} />
      ))}
    </div>
  );
}
