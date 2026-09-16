"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WeeklyPriority } from "@/lib/types/tasks";
import { Tag } from "@/hooks/use-tags";
import TagManager from "./tag-manager";
import { Plus, HelpCircle, CalendarDays, Tag as TagIcon, Flag } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * TaskFormCompact
 * A command‑bar style form that matches the compact Task Row design.
 * - Calm chrome: muted backgrounds, borderless triggers
 * - Keyboard first: Enter to add; tokens suggested via tooltip
 * - Token preview chips inferred live from input
 */
interface TaskFormProps {
  onAdd: (title: string, tag: string, deadline: string, reminder: string, priority: string) => Promise<void>;
  weeklyPriorities: WeeklyPriority[];
  tags: Tag[];
  onTagsUpdated: () => Promise<void>;
}

export default function TaskForm({ onAdd, weeklyPriorities, tags, onTagsUpdated }: TaskFormProps) {
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

  const tokens = useMemo(() => extractTokens(title), [title]);

  return (
    <div className="mb-4">
      <div className="flex flex-col xl:flex-row gap-2">
        {/* Command input */}
        <div className="relative flex-1">
          <Input
            placeholder="New task… e.g., Draft copy @work #priority:high ^2025-09-05 !09:00"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            className="h-10 pr-10"
          />

          {/* Help tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Token help" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="text-xs">
                <div className="space-y-1">
                  <p className="font-medium text-card-foreground-foreground">Quick tokens</p>
                  <p>
                    <code className="rounded bg-muted-foreground px-1">@tag</code> <span className="text-muted-foreground">assigns tag</span>
                  </p>
                  <p>
                    <code className="rounded bg-muted-foreground px-1">#priority:high</code> <span className="text-muted-foreground">sets priority</span>
                  </p>
                  <p>
                    <code className="rounded bg-muted-foreground px-1">^YYYY-MM-DD</code> <span className="text-muted-foreground">sets due date</span>
                  </p>
                  <p>
                    <code className="rounded bg-muted-foreground px-1">!HH:MM</code> <span className="text-muted-foreground">sets reminder</span>
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Tag select (compact) */}
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="h-10 w-auto border-0 bg-muted/60 shadow-none" aria-label="Select tag">
            <SelectValue placeholder="Tag">
              {tag && (
                <span className="inline-flex items-center gap-1">
                  <TagIcon className="h-3.5 w-3.5" />
                  {tags.find((t) => t.id === tag)?.name ?? tag}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Tags</SelectLabel>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
              <SelectSeparator />
              {/* Inline tag manager slot if you have it */}
              <div className="px-2 py-1 text-xs text-muted-foreground">Manage tags in settings</div>
              <TagManager onTagsUpdated={onTagsUpdated} />
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Priority select (compact) */}
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-10 w-auto border-0 bg-muted/60 shadow-none" aria-label="Link to priority">
            <SelectValue placeholder="Priority">
              {priority && (
                <span className="inline-flex items-center gap-1">
                  <Flag className="h-3.5 w-3.5" />
                  {weeklyPriorities.find((p) => p.id === priority)?.title ?? (priority === "none" ? "None" : priority)}
                </span>
              )}
            </SelectValue>
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

        {/* Add */}
        <Button size="sm" onClick={handleAdd} aria-label="Add task" className="h-10 gap-1">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {/* Live token preview (chips) */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {tokens.tag && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-slate-600/10 px-2 text-slate-700">
            <TagIcon className="h-3.5 w-3.5" /> {tokens.tag}
          </span>
        )}
        {tokens.priority && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-500/15 px-2 text-amber-700">
            <Flag className="h-3.5 w-3.5" /> {tokens.priority}
          </span>
        )}
        {tokens.date && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2">
            <CalendarDays className="h-3.5 w-3.5" /> {tokens.date}
          </span>
        )}
        {tokens.time && <span className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2">⏰ {tokens.time}</span>}
        {!tokens.tag && !tokens.priority && !tokens.date && !tokens.time && (
          <p className="text-muted-foreground">
            Tip: use <code className="rounded bg-muted px-1">@</code> <code className="rounded bg-muted px-1">#</code>{" "}
            <code className="rounded bg-muted px-1">^</code> <code className="rounded bg-muted px-1">!</code> tokens to auto-fill.
          </p>
        )}
      </div>
    </div>
  );
}

function extractTokens(text: string) {
  const tag = (text.match(/@([\w-]+)/)?.[1] ?? "").trim();
  const priority = (text.match(/#priority:([\w-]+)/i)?.[1] ?? "").trim();
  const date = (text.match(/\^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "").trim();
  const time = (text.match(/!(\d{2}:\d{2})/)?.[1] ?? "").trim();
  return { tag, priority, date, time };
}
