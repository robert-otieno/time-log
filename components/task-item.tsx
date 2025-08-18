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

interface TaskItemProps {
  task: UITask;
  onToggleTask: (id: number, done: boolean) => Promise<void>;
  onDeleteTask: (id: number) => Promise<void>;
  onAddSubtask: (taskId: number, title: string) => Promise<void>;
  onToggleSubtask: (id: number, done: boolean) => Promise<void>;
  onDeleteSubtask: (id: number) => Promise<void>;
  onEdit: (task: UITask) => void;
  onSelect: (id: number) => void;
}

export default function TaskItem({ task, onToggleTask, onDeleteTask, onAddSubtask, onToggleSubtask, onDeleteSubtask, onEdit, onSelect }: TaskItemProps) {
  const [open, setOpen] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");

  const handleAddSubtask = async () => {
    await onAddSubtask(task.id, newSubtask);
    setNewSubtask("");
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
              <span className={`truncate ${task.done ? "line-through text-muted-foreground text-sm" : "font-medium text-sm"}`}>{task.title}</span>

              {task.link && (
                <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Open link">
                  <a href={task.link} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}

              {task.notes && <Badge variant="secondary">Note</Badge>}

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

              {task.priority && (
                <Badge variant="secondary" className="capitalize">
                  {task.priority.title}
                </Badge>
              )}

              {typeof task.count === "number" && (
                <span className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs">{task.count}</span>
              )}
            </div>
          </div>

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
                <DropdownMenuItem onClick={() => onEdit(task)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSelect(task.id)}>Details</DropdownMenuItem>
                <DropdownMenuItem disabled>Duplicate (coming soon)</DropdownMenuItem>
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
