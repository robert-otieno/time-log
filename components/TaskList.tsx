"use client";

import { useState, useEffect } from "react";
import {
  addDailyTask,
  toggleDailyTask,
  deleteDailyTask,
  getTodayTasks,
} from "@/app/actions";
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
import type { DailyTask } from "@/db/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// export default function TaskList({ date }: { date: string }) {
//   const formattedDate = new Date(date).toLocaleDateString(undefined, {
//     year: "numeric",
//     month: "numeric",
//     day: "numeric",
//   });
interface TaskListProps {
  date: string;
}

export default function TaskList({ date }: TaskListProps) {

  const tagOptions = ["Work", "Personal", "Study", "Event Planning", "Will", "GBDCEI"];

  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [newTask, setNewTask] = useState("");
  const [newTag, setNewTag] = useState(tagOptions[0])

  useEffect(() => {
    loadTasks();
  }, [date]);

  async function loadTasks() {
    const res = await getTodayTasks(date);
    setTasks(res);
  }

  async function handleAddTask() {
    if (!newTask.trim()) return;
    await addDailyTask(newTask, date, newTag);
    setNewTask("");
    setNewTask(tagOptions[0]);
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

  const groupedTasks = tasks.reduce<Record<string, any[]>>((groups, task) => {
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

          <Select
            value={newTag}
            onValueChange={(v) => setNewTag(v)}
          >
            <SelectTrigger
              className="h-9 w-[180px] rounded-md"
              aria-label="Select tag"
            >
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
            <li className="py-6 text-sm text-muted-foreground">
              Nothing scheduled. Try “STEAM Bingo Card – GBDCEI” or “Newsletter Q2 outline.”
            </li>
          </ul>
        ) : (
          orderedGroups.map(([tag, tagTasks]) => (
            <div key={tag} className="mb-6 last:mb-0">
              <h3 className="mb-2 font-semibold capitalize">{tag}</h3>
              <ul className="divide-y">
                {tagTasks.map((task) => (
                  <li
                    key={task.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3"
                  >
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
                        <span
                          className={`truncate ${task.done ? "line-through text-muted-foreground" : "font-medium"}`}
                        >
                          {task.title}
                        </span>

                        {task.link && (
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Open link"
                          >
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

                        {task.tag && <Badge variant="outline" className="capitalize">{task.tag}</Badge>}

                        {typeof task.count === "number" && (
                          <span className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs">
                            {task.count}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-grab"
                        title="Drag to sort"
                      >
                        <GripVertical className="h-4 w-4" />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Task actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem disabled>
                            Edit (coming soon)
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
                            Duplicate (coming soon)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
