"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tagOptions } from "@/lib/tasks";

interface TaskFormProps {
  onAdd: (title: string, tag: string, deadline: string, reminder: string, priority: string) => Promise<void>;
  weeklyPriorities: { id: number; title: string }[];
}

export default function TaskForm({ onAdd, weeklyPriorities }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [deadline, setDeadline] = useState("");
  const [reminder, setReminder] = useState("");
  const [priority, setPriority] = useState("");

  const handleAdd = async () => {
    await onAdd(title, tag, deadline, reminder, priority);
    setTitle("");
    setTag("");
    setDeadline("");
    setReminder("");
    setPriority("");
  };

  return (
    <div className="mb-4 flex gap-2">
      <Input
        placeholder="New task… e.g., ‘Draft STEAM Bingo card copy’"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleAdd();
          }
        }}
        className="flex-1"
      />

      {/* <Input type="time" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-[120px]" aria-label="Deadline" /> */}

      {/* <Input type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} className="w-[120px]" aria-label="Reminder time" /> */}

      <Select value={tag} onValueChange={(v) => setTag(v)}>
        <SelectTrigger className="h-9 w-[180px] rounded-md" aria-label="Select tag">
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
        <SelectTrigger className="h-9 w-[180px] rounded-md" aria-label="Set priority">
          <SelectValue placeholder="Set Priority" />
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

      <Button size="icon" onClick={handleAdd} aria-label="Add task">
        <Plus />
      </Button>
    </div>
  );
}
