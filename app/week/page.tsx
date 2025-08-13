"use client"

import { formatISODate } from "@/lib/date-utils";
import { getWeeklyPriorities, addWeeklyPriority, deleteWeeklyPriority } from "../actions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tagOptions } from "@/components/TaskList";
import { useState } from "react";
import { toast } from "sonner";

export default async function WeekPage() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  const weekStart = formatISODate(monday);
  const [newTag, setNewTag] = useState(tagOptions[0]);
  const [title, setTitle] = useState("");

  const priorities = await getWeeklyPriorities(weekStart);

  async function handleAddPriority() {
    try {
      "use server"
      await addWeeklyPriority(title, weekStart, newTag);
    } catch (error: any) {
      toast.error("Failed to Add Priority", error);
    }
  }

  async function handleDeletePriority(id: number) {
    try {
      "use server"
      await deleteWeeklyPriority(id);
    } catch (error) {
      toast.error("Failed to delete priority");
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Weekly Priorities — starting {weekStart}</h2>
      <div>
        <Input value={title} placeholder="Add priority" onChange={(e) => setTitle(e.target.value)} />

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

        <Button size="icon" onClick={handleAddPriority}>
          <Plus />
        </Button>
      </div>
      <ul className="space-y-2">
        {priorities.map((p) => (
          <li key={p.id} className="flex justify-between items-center border p-2 rounded">
            <span>{p.title}</span>
            <Button variant="default" onClick={() => handleDeletePriority(p.id)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
