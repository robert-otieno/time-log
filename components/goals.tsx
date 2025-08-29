"use client";

import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronRight, Plus, Trash2 } from "lucide-react";
import { formatISODate } from "@/lib/date-utils";
import { useState } from "react";
import { useGoals } from "@/hooks/use-goals";
import { useCategories } from "@/hooks/use-categories";
import CategoryManager from "@/components/category-manager";
import HabitTracker from "@/components/habit-tracker";
import { Badge } from "@/components/ui/badge";
import { useSelectedDate } from "@/hooks/use-selected-date";
import CircularProgress from "./progress-07";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

export default function Goals() {
  const { goals, addGoal, deleteGoal, addHabit, deleteHabit, toggleHabit } = useGoals();
  const [open, setOpen] = useState(false);
  const [addHabitOpen, setAddHabitOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [goalDeadline, setGoalDeadline] = useState<Date | undefined>();
  const [habitInputs, setHabitInputs] = useState<Record<string, string>>({});
  const { selectedDate } = useSelectedDate();
  const { categories, loadCategories } = useCategories();

  function handleAddGoal() {
    const deadline = goalDeadline ? formatISODate(goalDeadline) : null;
    const categoryName = categories.find((c) => c.id === newCategory)?.name ?? "";
    addGoal(categoryName, newTitle, deadline);
    setNewCategory("");
    setNewTitle("");
    setGoalDeadline(undefined);
  }

  function handleAddHabit(goalId: string) {
    const name = habitInputs[goalId];
    addHabit(goalId, name);
    setHabitInputs((prev) => ({ ...prev, [goalId]: "" }));
  }

  return (
    <section id="goals" className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">Goals</CardTitle>
          <CardDescription className="text-xs sm:text-sm mb-3">Make your goals specific, measurable, achievable, and relevant</CardDescription>

          <div className="flex flex-col md:flex-row gap-2">
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-full rounded-md" aria-label="Select category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Category</SelectLabel>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <CategoryManager onCategoriesUpdated={loadCategories} />

            <Input placeholder="Goal" className="w-full" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />

            <div className="flex gap-2">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 gap-1">
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

              <Button size="icon" aria-label="Add goals" onClick={handleAddGoal}>
                <Plus />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {goals.map((goal) => {
            const today = new Date(selectedDate);
            const allCompletions = goal.habits.flatMap((h) => h.completions);
            const totalCompleted = allCompletions.reduce((sum, c) => sum + c.value, 0);
            let progress = 0;
            let paceLabel = "";

            if (goal.targetDate) {
              const targetDate = new Date(goal.targetDate);
              const completionDates = allCompletions.map((c) => new Date(c.date));
              const earliest = completionDates.length > 0 ? new Date(Math.min(...completionDates.map((d) => d.getTime()))) : today;
              const totalDays = Math.max(1, Math.ceil((targetDate.getTime() - earliest.getTime()) / 86400000) + 1);
              const daysPassed = Math.min(totalDays, Math.max(0, Math.ceil((today.getTime() - earliest.getTime()) / 86400000) + 1));
              const target = goal.habits.reduce((sum, h) => sum + h.target * totalDays, 0);
              progress = target > 0 ? (totalCompleted / target) * 100 : 0;
              const expected = goal.habits.reduce((sum, h) => sum + h.target * daysPassed, 0) / target;
              paceLabel = progress / 100 >= expected ? "On pace" : "Behind";
            } else {
              const target = goal.habits.reduce((sum, h) => sum + h.target * 7, 0);
              progress = target > 0 ? (totalCompleted / target) * 100 : 0;
            }

            const paceBadgeClass = (paceLabel: string) => (paceLabel === "On pace" ? "bg-emerald-600/10 text-emerald-600" : "bg-red-600/10 text-red-600");

            return (
              <div key={goal.id}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex gap-1">
                    <CircularProgress value={progress} size={45} strokeWidth={4} />
                    <div className="space-y-2 sm:flex sm:items-center sm:gap-2 sm:space-y-0">
                      <div className="text-sm font-medium">{goal.title}</div>
                      <div className="flex gap-2">
                        {goal.targetDate && (
                          <Badge className={`rounded-full shadow-none font-normal ${paceBadgeClass(paceLabel)}`} aria-label={`Pace status: ${paceLabel}`}>
                            {paceLabel}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs capitalize">
                          {goal.category}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Button variant="ghost" size="icon" aria-label="Delete goal" onClick={() => deleteGoal(goal.id)} className="hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div>
                  <Collapsible open={addHabitOpen} onOpenChange={setAddHabitOpen}>
                    <div className="mb-2 flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-0 transition-transform data-[state=open]:rotate-90 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring" aria-label="Toggle habits">
                          <ChevronRight />
                        </Button>
                      </CollapsibleTrigger>

                      <div className="flex w-full flex-col gap-1">
                        {goal.habits.map((habit) => (
                          <div key={habit.id} className="flex items-center justify-between gap-2 rounded-md">
                            <HabitTracker habit={habit} onToggle={toggleHabit} />

                            <Button variant="ghost" size="icon" aria-label="Delete habit" onClick={() => deleteHabit(habit.id)} className="hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <CollapsibleContent
                      className="
          overflow-hidden
          transition-all
          data-[state=closed]:animate-none data-[state=closed]:opacity-0 data-[state=closed]:max-h-0
          data-[state=open]:opacity-100 data-[state=open]:max-h-32
        "
                    >
                      <div className="flex items-center gap-2">
                        <Input placeholder="New habit" value={habitInputs[goal.id] ?? ""} onChange={(e) => setHabitInputs((prev) => ({ ...prev, [goal.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleAddHabit(goal.id)} className="h-8 flex-1 rounded-md" aria-label="New habit name" />
                        <Button size="sm" aria-label="Add habit" onClick={() => handleAddHabit(goal.id)} className="focus-visible:ring-2 focus-visible:ring-ring">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
