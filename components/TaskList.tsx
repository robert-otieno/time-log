"use client";

import { useState, useEffect } from "react";
import { addDailyTask, toggleDailyTask, deleteDailyTask, getTodayTasks, addDailySubtask, toggleDailySubtask, deleteDailySubtask } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, ExternalLink, ChevronRight, Flame, GripVertical, MoreVertical, Plus, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TaskWithSubtasks } from "@/db/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

type UITask = TaskWithSubtasks & { dueLabel?: string; hot?: boolean; link?: any; count?: any };

interface TaskListProps {
  date: string;
}

export default function TaskList({ date }: TaskListProps) {
  const tagOptions = ["Work", "Personal", "Study", "Event Planning", "Will", "GBDCEI"];

  const [tasks, setTasks] = useState<UITask[]>([]);
  const [newTask, setNewTask] = useState("");
  const [newTag, setNewTag] = useState(tagOptions[0]);
  const [newDeadline, setNewDeadline] = useState("");
  const [newReminder, setNewReminder] = useState("");
  const [newSubtasks, setNewSubtasks] = useState<Record<number, string>>({});
  const [openTasks, setOpenTasks] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadTasks();
  }, [date]);

  async function loadTasks() {
    const res = await getTodayTasks(date);
    const now = Date.now();
    const withMeta = res.map((t) => {
      let dueLabel: string | undefined;
      let hot = false;
      if (t.deadline) {
        const d = new Date(t.deadline);
        dueLabel = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const diff = d.getTime() - now;
        hot = diff > 0 && diff <= 60 * 60 * 1000 && !t.done;
      }
      return { ...t, dueLabel, hot };
    });
    setTasks(withMeta);
  }

  async function handleAddTask() {
    if (!newTask.trim()) return;
    const deadlineISO = newDeadline ? `${date}T${newDeadline}` : null;
    const reminderISO = newReminder ? `${date}T${newReminder}` : null;
    await addDailyTask(newTask, date, newTag, deadlineISO, reminderISO);
    setNewTask("");
    setNewTag(tagOptions[0]);
    setNewDeadline("");
    setNewReminder("");
    await loadTasks();
  }

  async function handleToggleTask(id: number, done: boolean) {
    await toggleDailyTask(id, !done);
    await loadTasks();
  }

  async function handleDeleteTask(id: number) {
    await deleteDailyTask(id);
    await loadTasks();
  }

  async function handleAddSubtask(taskId: number) {
    const title = newSubtasks[taskId];
    if (!title?.trim()) return;
    await addDailySubtask(taskId, title);
    setNewSubtasks((prev) => ({ ...prev, [taskId]: "" }));
    await loadTasks();
  }

  async function handleToggleSubtask(id: number, done: boolean) {
    await toggleDailySubtask(id, !done);
    await loadTasks();
  }

  async function handleDeleteSubtask(id: number) {
    await deleteDailySubtask(id);
    await loadTasks();
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const timers: number[] = [];
    tasks.forEach((t) => {
      if (t.reminderTime && !t.done) {
        const remindAt = new Date(t.reminderTime);
        const delay = remindAt.getTime() - Date.now();
        if (delay > 0) {
          const id = window.setTimeout(() => {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(t.title, {
                body: t.deadline ? `Due at ${new Date(t.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : undefined,
              });
            }
          }, delay);
          timers.push(id);
        }
      }
    });
    return () => {
      timers.forEach((id) => clearTimeout(id));
    };
  }, [tasks]);

  const groupedTasks = tasks.reduce<Record<string, UITask[]>>((groups, task) => {
    const tag = task.tag || "Other";
    (groups[tag] = groups[tag] || []).push(task);
    return groups;
  }, {});

  const orderedGroups = Object.entries(groupedTasks).sort((a, b) => {
    const idxA = tagOptions.indexOf(a[0]);
    const idxB = tagOptions.indexOf(b[0]);
    return (idxA === -1 ? tagOptions.length : idxA) - (idxB === -1 ? tagOptions.length : idxB);
  });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl">Tasks - {date}</CardTitle>

        <div className="mt-3 flex gap-2">
          <Input
            placeholder="New task… e.g., ‘Draft STEAM Bingo card copy’"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
            className="flex-1"
          />

          <Input type="time" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} className="w-[120px]" aria-label="Deadline" />

          <Input type="time" value={newReminder} onChange={(e) => setNewReminder(e.target.value)} className="w-[120px]" aria-label="Reminder time" />

          <Select value={newTag} onValueChange={(v) => setNewTag(v)}>
            <SelectTrigger className="h-9 w-[180px] rounded-md" aria-label="Select tag">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              {tagOptions.map((tag) => (
                <SelectItem key={tag} value={tag.toLowerCase()}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="icon" onClick={handleAddTask} aria-label="Add task">
            <Plus />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {tasks.length === 0 ? (
          <ul className="divide-y">
            <li className="py-6 text-sm text-muted-foreground">Nothing scheduled. Try “STEAM Bingo Card – GBDCEI” or “Newsletter Q2 outline.”</li>
          </ul>
        ) : (
          orderedGroups.map(([tag, tagTasks]) => (
            <div key={tag} className="mb-6 last:mb-0">
              <h3 className="mb-2 font-semibold capitalize">{tag}</h3>
              <ul className="divide-y">
                {tagTasks.map((task) => (
                  <li key={task.id} className="py-3">
                    <Collapsible open={openTasks[task.id]} onOpenChange={(o) => setOpenTasks((prev) => ({ ...prev, [task.id]: o }))}>
                      <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-0 data-[state=open]:rotate-90" aria-label="Toggle subtasks">
                            <ChevronRight />
                          </Button>
                        </CollapsibleTrigger>

                        {/* checkbox */}
                        <div className="grid place-items-center">
                          <Checkbox checked={task.done} onCheckedChange={() => handleToggleTask(task.id, task.done)} aria-label="Toggle task" />
                        </div>

                        {/* title + pills */}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`truncate ${task.done ? "line-through text-muted-foreground text-sm" : "font-medium text-sm"}`}>{task.title}</span>

                            {task.link && (
                              <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Open link">
                                <a href={task.link} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}

                            {task.hot && (
                              <Badge className="gap-1">
                                <Flame className="h-3.5 w-3.5" />
                                Hot
                              </Badge>
                            )}

                            {task.dueLabel && (
                              <Badge variant="secondary" className="gap-1">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {task.dueLabel}
                              </Badge>
                            )}

                            {task.tag && (
                              <Badge variant="outline" className="capitalize">
                                {task.tag}
                              </Badge>
                            )}

                            {typeof task.count === "number" && (
                              <span className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs">{task.count}</span>
                            )}
                          </div>
                        </div>

                        {/* actions */}
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-grab" title="Drag to sort">
                            <GripVertical className="h-4 w-4" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Task actions">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem disabled>Edit (coming soon)</DropdownMenuItem>
                              <DropdownMenuItem disabled>Duplicate (coming soon)</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <ul className="mt-2 ml-12 space-y-2">
                          {task.subtasks.map((sub) => (
                            <li key={sub.id} className="flex items-center gap-2 text-sm">
                              <Checkbox checked={sub.done} onCheckedChange={() => handleToggleSubtask(sub.id, sub.done)} aria-label="Toggle subtask" />
                              <span className={`flex-1 truncate ${sub.done ? "line-through text-muted-foreground" : ""}`}>{sub.title}</span>
                              <Button variant="ghost" size="icon" aria-label="Delete subtask" onClick={() => handleDeleteSubtask(sub.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                          <li className="flex items-center gap-2">
                            <Input
                              placeholder="Add subtask"
                              value={newSubtasks[task.id] || ""}
                              onChange={(e) =>
                                setNewSubtasks((prev) => ({
                                  ...prev,
                                  [task.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => e.key === "Enter" && handleAddSubtask(task.id)}
                              className="flex-1"
                            />
                            <Button size="icon" onClick={() => handleAddSubtask(task.id)} aria-label="Add subtask">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </li>
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
