"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronRight, ExternalLink, Flame, GripVertical, MoreVertical, Plus, Trash2, CalendarDays } from "lucide-react";
import type { UITask } from "@/hooks/use-tasks";
import { formatISODate } from "@/lib/date-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { WeeklyPriority } from "@/lib/types/tasks";
import { Tag } from "@/hooks/use-tags";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface TaskItemProps {
  task: UITask;
  onToggleTask: (id: string, done: boolean) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onAddSubtask: (taskId: string, title: string) => Promise<void>;
  onToggleSubtask: (id: string, done: boolean) => Promise<void>;
  onDeleteSubtask: (id: string) => Promise<void>;
  onEdit: (task: UITask) => void;
  onSelect: (id: string) => void;
  onUpdateTask: (id: string, values: { title: string; tag: string; deadline: string; reminder: string; priority: string }) => Promise<void>;
  weeklyPriorities: WeeklyPriority[];
  tags: Tag[];
}

export default function TaskItem({
  task,
  onToggleTask,
  onDeleteTask,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onEdit,
  onSelect,
  onUpdateTask,
  weeklyPriorities,
  tags,
}: TaskItemProps) {
  const [open, setOpen] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueOpen, setDueOpen] = useState(false);

  const defaults = {
    title: task.title,
    tag: task.tag ?? "",
    deadline: task.deadline ? task.deadline.split("T")[0] : "",
    reminder: task.reminderTime ? task.reminderTime.split("T")[1]?.slice(0, 5) ?? "" : "",
    priority: task.weeklyPriorityId ? String(task.weeklyPriorityId) : "none",
  };

  const persist = async (changes: Partial<typeof defaults>) => {
    await onUpdateTask(task.id, { ...defaults, ...changes });
  };

  const handleAddSubtask = async () => {
    await onAddSubtask(task.id, newSubtask);
    setNewSubtask("");
  };

  const handleTitleSave = async () => {
    setEditingTitle(false);
    const newTitle = title.trim();
    if (newTitle && newTitle !== task.title) {
      await persist({ title: newTitle });
    } else {
      setTitle(task.title);
    }
  };

  const handleTagChange = async (v: string) => {
    await persist({ tag: v });
  };

  const handlePriorityChange = async (v: string) => {
    await persist({ priority: v });
  };

  const handleDueSelect = async (d: Date | undefined) => {
    setDueOpen(false);
    if (d) {
      await persist({ deadline: formatISODate(d) });
    }
  };

  return (
    <li className="py-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 data-[state=open]:rotate-90" aria-label="Toggle subtasks">
              <ChevronRight />
            </Button>
          </CollapsibleTrigger>

          <div className="grid place-items-center">
            <Checkbox checked={task.done} onCheckedChange={() => onToggleTask(task.id, task.done)} aria-label="Toggle task" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {editingTitle ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                  className="h-7 w-auto text-sm"
                  autoFocus
                />
              ) : (
                <span
                  className={`truncate ${task.done ? "line-through text-muted-foreground text-sm" : "font-medium text-sm"}`}
                  onDoubleClick={() => setEditingTitle(true)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setEditingTitle(true)}
                >
                  {task.title}
                </span>
              )}
              {task.link && (
                <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Open link">
                  <a href={task.link} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}

              {task.notes && <Badge variant="secondary">Note</Badge>}

              {task.hot && (
                <Badge className="gap-1 bg-orange-600/10 dark:bg-orange-500/20 text-orange-500">
                  <Flame className="h-3.5 w-3.5 animate-pulse text-yellow-500" />
                  Hot
                </Badge>
              )}

              <Popover open={dueOpen} onOpenChange={setDueOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {task.dueLabel ?? "Set due"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={task.deadline ? new Date(task.deadline) : undefined} onSelect={handleDueSelect} captionLayout="dropdown" />
                </PopoverContent>
              </Popover>

              <Select defaultValue={task.tag ?? ""} onValueChange={handleTagChange}>
                <SelectTrigger size="sm" className="h-7 min-w-[120px] capitalize border-0" aria-label="Select tag">
                  <SelectValue placeholder="Tag" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {task.priority && (
                <Select defaultValue={defaults.priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger size="sm" className="h-7 w-[140px] border-0" aria-label="Select priority">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {weeklyPriorities.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {typeof task.count === "number" && (
                <span className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs">{task.count}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* <Button variant="ghost" size="icon" className="h-8 w-8 cursor-grab" title="Drag to sort">
              <GripVertical className="h-4 w-4" />
            </Button> */}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Task actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onEdit(task)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSelect(task.id)}>Details</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDeleteTask(task.id)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <CollapsibleContent>
          <ul className="mt-2 ml-12 space-y-2">
            {task.subtasks.map((sub: any) => (
              <li key={sub.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={sub.done} onCheckedChange={() => onToggleSubtask(sub.id, sub.done)} aria-label="Toggle subtask" />
                <span className={`flex-1 truncate ${sub.done ? "line-through text-muted-foreground" : ""}`}>{sub.title}</span>
                <Button variant="ghost" size="icon" aria-label="Delete subtask" onClick={() => onDeleteSubtask(sub.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Input
                placeholder="Add subtask"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                className="flex-1"
              />
              <Button size="icon" onClick={handleAddSubtask} aria-label="Add subtask">
                <Plus className="h-4 w-4" />
              </Button>
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
