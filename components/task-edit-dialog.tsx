"use client";

import { ReactNode, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UITask } from "@/hooks/use-tasks";
import { Tag } from "@/hooks/use-tags";
import TagManager from "./tag-manager";

interface TaskEditDialogProps {
  task: UITask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weeklyPriorities: { id: string; title: string; level: string }[];
  onSave: (id: string, values: { title: string; tag: string; deadline: string; reminder: string; priority: string }) => Promise<void>;
  tags: Tag[];
  onTagsUpdated: () => Promise<void>;
  trigger: ReactNode;
}

export default function TaskEditDialog({ task, open, onOpenChange, weeklyPriorities, onSave, tags, onTagsUpdated, trigger }: TaskEditDialogProps) {
  const [values, setValues] = useState({ title: "", tag: "", deadline: "", reminder: "", priority: "" });

  useEffect(() => {
    if (task) {
      setValues({
        title: task.title,
        tag: task.tag,
        deadline: task.deadline ? task.deadline.split("T")[1]?.slice(0, 5) : "",
        reminder: task.reminderTime ? task.reminderTime.split("T")[1]?.slice(0, 5) : "",
        priority: task.weeklyPriorityId ? String(task.weeklyPriorityId) : "none",
      });
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;
    await onSave(task.id, values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder="Title" value={values.title} onChange={(e) => setValues((prev) => ({ ...prev, title: e.target.value }))} />
          <Input type="time" value={values.deadline} onChange={(e) => setValues((prev) => ({ ...prev, deadline: e.target.value }))} aria-label="Deadline" />
          <Input
            type="time"
            value={values.reminder}
            onChange={(e) => setValues((prev) => ({ ...prev, reminder: e.target.value }))}
            aria-label="Reminder time"
          />

          <div className="flex gap-2">
            <Select value={values.tag} onValueChange={(v) => setValues((prev) => ({ ...prev, tag: v }))}>
              <SelectTrigger className="h-9 w-full" aria-label="Select tag">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TagManager onTagsUpdated={onTagsUpdated} />
          </div>

          <Select value={values.priority} onValueChange={(v) => setValues((prev) => ({ ...prev, priority: v }))}>
            <SelectTrigger className="h-9 w-full" aria-label="Select priority">
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
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
