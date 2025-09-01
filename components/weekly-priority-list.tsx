"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { priorityOptions } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { formatISODate, formatWeekRange } from "@/lib/date-utils";
import { GripVertical, MoreVertical, Plus, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getWeeklyPriorities, addWeeklyPriority, deleteWeeklyPriority, updateWeeklyPriority } from "@/app/actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Priority {
  id: string;
  title: string;
  tag?: string | null;
  level?: string | null;
  progress?: number;
  completed?: boolean;
  weekStart: string;
}

export default function WeeklyPriorityList() {
  const { selectedDate } = useSelectedDate();
  const current = new Date(selectedDate);
  const dayOfWeek = current.getDay();
  const diff = current.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(current);
  monday.setDate(diff);
  const weekStart = formatISODate(monday);
  const weekRange = formatWeekRange(monday);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [newPriority, setNewPriority] = useState("");
  const [newPriorityLevel, setNewPriorityLevel] = useState("medium");
  const [filter, setFilter] = useState<"all" | "work" | "personal">("all");
  const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingLevel, setEditingLevel] = useState("medium");
  const visible = priorities.filter((p) => filter === "all" || p.tag === filter);

  useEffect(() => {
    loadPriorities();
  }, [selectedDate]);

  async function loadPriorities() {
    const res: Priority[] = await getWeeklyPriorities(weekStart);
    setPriorities(res.map((p) => ({ ...p, tag: p.tag ?? "work", level: p.level ?? "medium" })));
  }

  async function handleAddPriority() {
    if (!newPriority.trim()) return;
    const tag = filter === "all" ? "work" : filter;
    await addWeeklyPriority(newPriority, weekStart, tag, newPriorityLevel);
    setNewPriority("");
    setNewPriorityLevel("medium");
    await loadPriorities();
  }

  async function handleDeletePriority(id: string) {
    await deleteWeeklyPriority(id);
    await loadPriorities();
  }

  async function handleRenamePriority(id: string) {
    if (!editingTitle.trim()) {
      setEditingPriorityId(null);
      return;
    }
    await updateWeeklyPriority(id, { title: editingTitle, level: editingLevel });
    setEditingPriorityId(null);
    setEditingTitle("");
    setEditingLevel("medium");
    await loadPriorities();
  }

  return (
    <section id="weekly-priorities">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>{`Priorities: Week - ${weekRange}`}</CardTitle>
          <CardDescription className="mb-3">Set your weekly priorities to focus on what matters most.</CardDescription>

          <div className="flex gap-2">
            <Input placeholder="New priority… e.g., ‘Submit thesis draft’" value={newPriority} onChange={(e) => setNewPriority(e.target.value)} />
            <Select value={newPriorityLevel} onValueChange={setNewPriorityLevel}>
              <SelectTrigger className="w-[120px]" aria-label="Select level">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((p) => (
                  <SelectItem key={p.toLowerCase()} value={p.toLowerCase()}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>{" "}
            <Button size="icon" onClick={handleAddPriority} aria-label="Add priority">
              <Plus />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <ul className="divide-y">
            {visible.length === 0 && (
              <li className="text-xs text-muted-foreground">
                No priorities yet. Try “Wedding planning,” “Identify photography venue,” or “Chapter 1–2 thesis.”
              </li>
            )}

            {visible.map((p: Priority) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  {editingPriorityId === p.id ? (
                    <div className="flex items-center gap-2">
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
                        className="h-8"
                        autoFocus
                      />
                      <Select value={editingLevel} onValueChange={setEditingLevel}>
                        <SelectTrigger className="h-8 w-[110px]" aria-label="Priority level">
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
                      <Button size="icon" onClick={() => handleRenamePriority(p.id)} aria-label="Save priority">
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
                      >
                        {" "}
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`truncate font-medium ${p.completed ? "line-through text-muted-foreground" : ""}`}>{p.title}</span>
                      <Badge variant="outline" className="capitalize">
                        {p.level}
                      </Badge>
                      {p.completed && (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3.5 w-3.5" /> Done
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={p.progress ?? 0} className="h-2 w-56 max-w-full" />
                    <span className="text-xs text-muted-foreground">{(p.progress ?? 0).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* <Button variant="ghost" size="icon" className="h-8 w-8 cursor-grab" title="Drag to sort">
                    <GripVertical className="h-4 w-4" />
                  </Button> */}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Priority actions">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingPriorityId(p.id);
                          setEditingTitle(p.title);
                          setEditingLevel(p.level ?? "medium");
                        }}
                      >
                        Rename
                      </DropdownMenuItem>{" "}
                      {/* <DropdownMenuItem disabled>Add subtask (coming soon)</DropdownMenuItem> */}
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
            <Badge variant="secondary" className="text-xs overflow-auto">
              Tip: Use the menu to manage priorities. Drag handle to reorder.
            </Badge>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
