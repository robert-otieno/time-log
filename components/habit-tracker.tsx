"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { HabitWithCompletions } from "@/app/actions";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { Label } from "@/components/ui/label";

interface HabitTrackerProps {
  habit: HabitWithCompletions;
  onToggle: (habitId: number, date: string) => void;
}

export default function HabitTracker({ habit, onToggle }: HabitTrackerProps) {
  const { selectedDate } = useSelectedDate();
  const checked = habit.completions.includes(selectedDate);

  return (
    <div className="flex items-center gap-2">
      <Checkbox id={`habit-${habit.id}`} checked={checked} onCheckedChange={() => onToggle(habit.id, selectedDate)} />
      <Label className="font-normal" htmlFor={`habit-${habit.id}`}>{habit.name}</Label>
    </div>
  );
}
