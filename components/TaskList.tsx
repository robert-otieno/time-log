"use client";

import { useState, useEffect } from "react";
import { addDailyTask, toggleDailyTask, deleteDailyTask, getTodayTasks } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, ExternalLink, Flame, GripVertical, MoreVertical, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function TaskList() {
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const [tasks, setTasks] = useState<any[]>([]);
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    const res = await getTodayTasks(today);
    setTasks(res);
  }

  async function handleAddTask() {
    if (!newTask.trim()) return;
    await addDailyTask(newTask, today);
    setNewTask("");
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

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl">Today — {today}</CardTitle>

        <div className="mt-3 flex gap-2">
          <Input
            placeholder="New task… e.g., ‘Draft STEAM Bingo card copy’"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
          />
          <Button size="icon" onClick={handleAddTask} aria-label="Add task">
            <Plus />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <ul className="divide-y">
          {tasks.length === 0 && (
            <li className="py-6 text-sm text-muted-foreground">
              Nothing scheduled. Try “STEAM Bingo Card – GBDCEI” or “Newsletter Q2 outline.”
            </li>
          )}

          {tasks.map((task) => (
            <li key={task.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
              {/* checkbox */}
              <div className="h-8 w-8 grid place-items-center">
                <Checkbox
                  checked={task.done}
                  onCheckedChange={() => handleToggleTask(task.id, task.done)}
                  aria-label="Toggle task"
                />
              </div>

              {/* title + pills */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`truncate ${task.done ? "line-through text-muted-foreground" : "font-medium"}`}>
                    {task.title}
                  </span>

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

                  {typeof task.count === "number" && (
                    <span className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs">
                      {task.count}
                    </span>
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
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
