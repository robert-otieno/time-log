"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tagOptions } from "@/lib/tasks";
import { WeeklyPriority } from "@/lib/types/tasks";

interface TaskFormProps {
  onAdd: (title: string, tag: string, deadline: string, reminder: string, priority: string) => Promise<void>;
  weeklyPriorities: WeeklyPriority[];
}

export default function TaskForm({ onAdd, weeklyPriorities }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [deadline, setDeadline] = useState("");
  const [reminder, setReminder] = useState("");
  const [priority, setPriority] = useState("");

  const handleAdd = async () => {
    let cleanTitle = title;
    let parsedTag = tag;
    let parsedPriority = priority;
    let parsedDeadline = deadline;
    let parsedReminder = reminder;

    const tagMatch = cleanTitle.match(/@(\w+)/);
    if (tagMatch) {
      parsedTag = tagMatch[1];
      cleanTitle = cleanTitle.replace(tagMatch[0], "").trim();
    }

    const priorityMatch = cleanTitle.match(/#priority:(\w+)/);
    if (priorityMatch) {
      parsedPriority = priorityMatch[1];
      cleanTitle = cleanTitle.replace(priorityMatch[0], "").trim();
    }

    const deadlineMatch = cleanTitle.match(/\^(\d{4}-\d{2}-\d{2})/);
    if (deadlineMatch) {
      parsedDeadline = deadlineMatch[1];
      cleanTitle = cleanTitle.replace(deadlineMatch[0], "").trim();
    }

    const reminderMatch = cleanTitle.match(/!(\d{2}:\d{2})/);
    if (reminderMatch) {
      parsedReminder = reminderMatch[1];
      cleanTitle = cleanTitle.replace(reminderMatch[0], "").trim();
    }

    await onAdd(cleanTitle.trim(), parsedTag, parsedDeadline, parsedReminder, parsedPriority);
    setTitle("");
    setTag("");
    setDeadline("");
    setReminder("");
    setPriority("");
  };

  return (
    <div className="mb-4">
      <div className="flex gap-2">
        <Input
          placeholder="New task… e.g., 'Draft copy @work #priority:1 ^2024-05-01 !09:00'"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleAdd();
            }
          }}
          className="flex-1"
        />

        <Select value={tag} onValueChange={(v) => setTag(v)}>
          <SelectTrigger className="h-9 rounded-md" aria-label="Select tag">
            <SelectValue placeholder="Select Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Tags</SelectLabel>
              {tagOptions.map((t) => (
                <SelectItem key={t} value={t.toLowerCase()}>
                  {t}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={(v) => setPriority(v)}>
          <SelectTrigger className="h-9 rounded-md" aria-label="Link to priority">
            <SelectValue placeholder="Link to Priority" />
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

        <Button size="icon" onClick={handleAdd} aria-label="Add task">
          <Plus />
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Tokens: @tag #priority:&lt;level&gt; ^YYYY-MM-DD !HH:MM</p>
    </div>
  );
}
