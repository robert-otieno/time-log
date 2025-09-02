"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { priorityOptions } from "@/lib/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useMemo, useState } from "react";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { formatISODate, formatWeekRange } from "@/lib/date-utils";
import { Check, GripVertical, MoreVertical, Plus, X } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getWeeklyPriorities, addWeeklyPriority, deleteWeeklyPriority, updateWeeklyPriority } from "@/app/actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Priority {
  id: string;
  title: string;
  tag?: "work" | "personal" | string | null;
  level?: "low" | "medium" | "high" | string | null;
  progress?: number | null;
  completed?: boolean | null;
  weekStart: string;
}

export default function WeeklyPriorityList() {
  const { selectedDate } = useSelectedDate();

  // Derive Monday (start of ISO week) and formatted range from selectedDate
  const { weekStart, weekRange } = useMemo(() => {
    const current = new Date(selectedDate);
    const dow = current.getDay(); // 0..6, Sun=0
    const diff = current.getDate() - dow + (dow === 0 ? -6 : 1); // shift to Monday
    const monday = new Date(current);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return { weekStart: formatISODate(monday), weekRange: formatWeekRange(monday) };
  }, [selectedDate]);

  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [newPriority, setNewPriority] = useState("");
  const [newPriorityLevel, setNewPriorityLevel] = useState<"low" | "medium" | "high">("medium");
  const [filter, setFilter] = useState<"all" | "work" | "personal">("all");
  const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingLevel, setEditingLevel] = useState<"low" | "medium" | "high">("medium");

  // load when weekStart changes
  useEffect(() => {
    loadPriorities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function loadPriorities() {
    const res: Priority[] = await getWeeklyPriorities(weekStart);
    setPriorities(
      res.map((p) => ({
        ...p,
        tag: (p.tag as any) ?? "work",
        level: ((p.level as any) ?? "medium") as any,
        progress: p.progress ?? 0,
        completed: p.completed ?? false,
      }))
    );
  }

  async function handleAddPriority() {
    const title = newPriority.trim();
    if (!title) return;
    const tag = filter === "all" ? "work" : filter; // default to work if no filter selected
    await addWeeklyPriority(title, weekStart, tag, newPriorityLevel);
    setNewPriority("");
    setNewPriorityLevel("medium");
    await loadPriorities();
  }

  async function handleDeletePriority(id: string) {
    await deleteWeeklyPriority(id);
    await loadPriorities();
  }

  async function handleRenamePriority(id: string) {
    const title = editingTitle.trim();
    if (!title) {
      setEditingPriorityId(null);
      setEditingTitle("");
      return;
    }
    await updateWeeklyPriority(id, { title, level: editingLevel });
    setEditingPriorityId(null);
    setEditingTitle("");
    setEditingLevel("medium");
    await loadPriorities();
  }

  async function handleToggleCompleted(p: Priority) {
    await updateWeeklyPriority(p.id, { completed: !p.completed });
    await loadPriorities();
  }

  const visible = priorities.filter((p) => filter === "all" || p.tag === filter);

  const levelBadge = (level?: Priority["level"]) => {
    const l = (level ?? "medium").toString().toLowerCase();
    const base = "inline-flex items-center h-6 rounded-full px-2 text-xs capitalize";
    if (l === "high") return <span className={`${base} bg-red-600/10 text-red-700`}>high</span>;
    if (l === "low") return <span className={`${base} bg-slate-600/10 text-slate-700`}>low</span>;
    return <span className={`${base} bg-amber-500/15 text-amber-700`}>medium</span>;
  };

  return (
    <section id="weekly-priorities">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">{`Priorities · ${weekRange}`}</CardTitle>
          <CardDescription className="mb-3 text-xs sm:text-sm">Set this week’s top outcomes, then track progress below.</CardDescription>

          {/* Add row */}
          <div className="space-y-2">
            {/* Filter chips */}
            <div className="flex items-center justify-between gap-2">
              <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as any)} className="rounded-lg bg-muted/50 p-0.5">
                <ToggleGroupItem value="all" className="px-3 h-7 text-xs data-[state=on]:bg-background rounded-md">
                  All
                </ToggleGroupItem>
                <ToggleGroupItem value="work" className="px-3 h-7 text-xs data-[state=on]:bg-background rounded-md">
                  Work
                </ToggleGroupItem>
                <ToggleGroupItem value="personal" className="px-3 h-7 text-xs data-[state=on]:bg-background rounded-md">
                  Personal
                </ToggleGroupItem>
              </ToggleGroup>
              <span className="text-[11px] text-muted-foreground">
                Showing {visible.length} / {priorities.length}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="New priority… e.g., ‘Submit thesis draft’"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddPriority()}
                className="h-10 flex-1"
              />

              {/* Level segmented control (faster than Select) */}
              <ToggleGroup
                type="single"
                value={newPriorityLevel}
                onValueChange={(v) => v && setNewPriorityLevel(v as any)}
                className="rounded-lg bg-muted/50 p-0.5"
              >
                <ToggleGroupItem value="low" className="px-3 h-10 text-sm data-[state=on]:bg-background rounded-md">
                  Low
                </ToggleGroupItem>
                <ToggleGroupItem value="medium" className="px-3 h-10 text-sm data-[state=on]:bg-background rounded-md">
                  Med
                </ToggleGroupItem>
                <ToggleGroupItem value="high" className="px-3 h-10 text-sm data-[state=on]:bg-background rounded-md">
                  High
                </ToggleGroupItem>
              </ToggleGroup>

              <Button onClick={handleAddPriority} aria-label="Add priority" className="h-10 gap-1">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <ul className="divide-y">
            {visible.length === 0 && (
              <li className="text-xs text-muted-foreground py-2">
                No priorities yet. Try “Wedding planning,” “Identify photography venue,” or “Chapter 1–2 thesis.”
              </li>
            )}

            {visible.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  {/* Row header */}
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground/60" />
                    <Checkbox checked={!!p.completed} onCheckedChange={() => handleToggleCompleted(p)} aria-label="Mark done" />

                    {editingPriorityId === p.id ? (
                      <>
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenamePriority(p.id);
                            if (e.key === "Escape") {
                              setEditingPriorityId(null);
                              setEditingTitle("");
                              setEditingLevel("medium");
                            }
                          }}
                          onBlur={() => handleRenamePriority(p.id)}
                          className="h-8 max-w-[60%]"
                          autoFocus
                        />
                        {/* inline level editor */}
                        <Select value={editingLevel} onValueChange={(v) => setEditingLevel(v as any)}>
                          <SelectTrigger className="h-8 w-[120px]" aria-label="Priority level">
                            <SelectValue placeholder="Level" />
                          </SelectTrigger>
                          <SelectContent>
                            {priorityOptions.map((opt) => (
                              <SelectItem key={opt.toLowerCase()} value={opt.toLowerCase()}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" onClick={() => handleRenamePriority(p.id)} aria-label="Save priority" className="h-8 w-8">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingPriorityId(null);
                            setEditingTitle("");
                            setEditingLevel("medium");
                          }}
                          aria-label="Cancel rename"
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className={`truncate font-medium ${p.completed ? "line-through text-muted-foreground" : ""}`}>{p.title}</span>
                        {levelBadge(p.level)}
                        {p.tag && (
                          <Badge variant="secondary" className="capitalize">
                            {p.tag}
                          </Badge>
                        )}
                        {p.completed && (
                          <Badge variant="secondary" className="gap-1">
                            <Check className="h-3.5 w-3.5" /> Done
                          </Badge>
                        )}
                      </>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={Math.max(0, Math.min(100, p.progress ?? 0))} className="h-1.5 w-56 max-w-full" />
                    <span className="text-xs text-muted-foreground tabular-nums">{Math.round(p.progress ?? 0)}%</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 self-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Priority actions">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingPriorityId(p.id);
                          setEditingTitle(p.title);
                          setEditingLevel(((p.level as any) ?? "medium") as any);
                        }}
                      >
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleCompleted(p)}>{p.completed ? "Mark as not done" : "Mark as done"}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeletePriority(p.id)} className="text-destructive">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>

          {/* Subtle helper */}
          <div className="mt-3">
            <Badge variant="secondary" className="text-xs">
              Tip: Use the menu to rename or mark done. Drag handle is for reordering (coming soon).
            </Badge>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
