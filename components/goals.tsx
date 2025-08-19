"use client";

import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { formatISODate } from "@/lib/date-utils";
import { useState } from "react";
import { useGoals } from "@/hooks/use-goals";
import { categories } from "@/lib/tasks";
import HabitTracker from "@/components/habit-tracker";
import { Badge } from "@/components/ui/badge";
import { useSelectedDate } from "@/hooks/use-selected-date";
import CircularProgress from "./progress-07";

export default function Goals() {
  const { goals, addGoal, deleteGoal, addHabit, deleteHabit, toggleHabit } = useGoals();
  const [open, setOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [goalDeadline, setGoalDeadline] = useState<Date | undefined>();
  const [habitInputs, setHabitInputs] = useState<Record<number, string>>({});
  const { selectedDate } = useSelectedDate();
  const recentDates = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - (6 - idx));
    return {
      date: formatISODate(d),
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
    };
  });

  function handleAddGoal() {
    const deadline = goalDeadline ? formatISODate(goalDeadline) : null;
    addGoal(newCategory, newTitle, deadline);
    setNewCategory("");
    setNewTitle("");
    setGoalDeadline(undefined);
  }

  function handleAddHabit(goalId: number) {
    const name = habitInputs[goalId];
    addHabit(goalId, name);
    setHabitInputs((prev) => ({ ...prev, [goalId]: "" }));
  }

  return (
    <section id="goals" className="mb-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Goals</CardTitle>
          <CardDescription className="mb-4">Make your goals specific, measurable, achievable, and relevant</CardDescription>

          <div className="flex gap-2">
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="h-9 w-[180px] rounded-md" aria-label="Select category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Category</SelectLabel>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat.toLowerCase()}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Input placeholder="Goal" className="w-full" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />

            <div className="flex flex-col gap-3">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-1">
                    <CalendarDays />
                    {goalDeadline ? formatISODate(goalDeadline) : "Set Deadline"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={goalDeadline}
                    captionLayout="dropdown"
                    onSelect={(d) => {
                      if (d) setGoalDeadline(d);
                      setOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button size="icon" aria-label="Add goals" onClick={handleAddGoal}>
              <Plus />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-8 gap-1 text-xs text-muted-foreground">
            <span />
            {recentDates.map((d) => (
              <span key={d.date} className="text-center">
                {d.label}
              </span>
            ))}
          </div>
          {goals.map((goal) => {
            const today = new Date(selectedDate);
            const allCompletions = goal.habits.flatMap((h) => h.completions);
            const totalCompleted = allCompletions.reduce((sum, c) => sum + c.value, 0);
            let progress = 0;
            let paceLabel = "";

            if (goal.deadline) {
              const deadline = new Date(goal.deadline);
              const completionDates = allCompletions.map((c) => new Date(c.date));
              const earliest = completionDates.length > 0 ? new Date(Math.min(...completionDates.map((d) => d.getTime()))) : today;
              const totalDays = Math.max(1, Math.ceil((deadline.getTime() - earliest.getTime()) / 86400000) + 1);
              const daysPassed = Math.min(totalDays, Math.max(0, Math.ceil((today.getTime() - earliest.getTime()) / 86400000) + 1));
              const target = goal.habits.reduce((sum, h) => sum + h.target * totalDays, 0);
              progress = target > 0 ? (totalCompleted / target) * 100 : 0;
              const expected = goal.habits.reduce((sum, h) => sum + h.target * daysPassed, 0) / target;
              paceLabel = progress / 100 >= expected ? "On pace" : "Behind";
            } else {
              const target = goal.habits.reduce((sum, h) => sum + h.target * 7, 0);
              progress = target > 0 ? (totalCompleted / target) * 100 : 0;
            }

            return (
              <div key={goal.id} className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <CircularProgress value={progress} size={50} strokeWidth={4} />
                      {goal.deadline && <span className={`text-xs ${paceLabel === "On pace" ? "text-green-600" : "text-red-600"}`}>{paceLabel}</span>}
                    </div>
                    <span className="font-medium text-sm">{goal.title}</span>
                    <Badge variant="secondary" className="text-sm capitalize">
                      {goal.category}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Delete goal" onClick={() => deleteGoal(goal.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="ml-4 space-y-2">
                  {goal.habits.map((habit) => (
                    <div key={habit.id} className="flex items-center gap-2">
                      <HabitTracker habit={habit} onToggle={toggleHabit} />
                      <Button variant="ghost" size="icon" aria-label="Delete habit" onClick={() => deleteHabit(habit.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="New habit"
                      value={habitInputs[goal.id] ?? ""}
                      onChange={(e) => setHabitInputs((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && handleAddHabit(goal.id)}
                      className="flex-1"
                    />
                    <Button size="icon" aria-label="Add habit" onClick={() => handleAddHabit(goal.id)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
