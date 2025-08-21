"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UITask } from "@/hooks/use-tasks";
import { tagOptions } from "@/lib/tasks";

interface TaskEditSheetProps {
  task: UITask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weeklyPriorities: { id: number; title: string; level: string }[];
  onSave: (id: number, values: { title: string; tag: string; deadline: string; reminder: string; priority: string }) => Promise<void>;
}

export default function TaskEditSheet({ task, open, onOpenChange, weeklyPriorities, onSave }: TaskEditSheetProps) {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Task</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 p-4">
          <Input placeholder="Title" value={values.title} onChange={(e) => setValues((prev) => ({ ...prev, title: e.target.value }))} />
          <Input type="time" value={values.deadline} onChange={(e) => setValues((prev) => ({ ...prev, deadline: e.target.value }))} aria-label="Deadline" />
          <Input
            type="time"
            value={values.reminder}
            onChange={(e) => setValues((prev) => ({ ...prev, reminder: e.target.value }))}
            aria-label="Reminder time"
          />
          <Select value={values.tag} onValueChange={(v) => setValues((prev) => ({ ...prev, tag: v }))}>
            <SelectTrigger className="h-9 w-full" aria-label="Select tag">
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
          <Select value={values.priority} onValueChange={(v) => setValues((prev) => ({ ...prev, priority: v }))}>
            <SelectTrigger className="h-9 w-full" aria-label="Select priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {weeklyPriorities.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SheetFooter>
          <Button onClick={handleSave}>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
