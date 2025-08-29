"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronRight, ExternalLink, Flame, MoreVertical, Plus, Trash2, CalendarDays, ChevronDownIcon, AlarmClockPlus } from "lucide-react";
import type { UITask } from "@/hooks/use-tasks";
import { formatISODate } from "@/lib/date-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { WeeklyPriority } from "@/lib/types/tasks";
import { badgeVariants } from "@/components/ui/badge";
import { Tag } from "@/hooks/use-tags";
import { Textarea } from "@/components/ui/textarea";
import { updateTaskDetails } from "@/app/actions/tasks";
import { Label } from "@/components/ui/label";

interface TaskItemProps {
  task: UITask;
  onToggleTask: (id: string, done: boolean) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onAddSubtask: (taskId: string, title: string) => Promise<void>;
  onToggleSubtask: (id: string, done: boolean) => Promise<void>;
  onDeleteSubtask: (id: string) => Promise<void>;
  onUpdateTask: (id: string, values: { title: string; tag: string; deadline: string; reminder: string; priority: string }) => Promise<void>;
  weeklyPriorities: WeeklyPriority[];
  tags: Tag[];
}

export default function TaskItem({ task, onToggleTask, onDeleteTask, onAddSubtask, onToggleSubtask, onDeleteSubtask, onUpdateTask, weeklyPriorities, tags }: TaskItemProps) {
  const [open, setOpen] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueOpen, setDueOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [tag, setTag] = useState(task.tag ?? "");
  const [deadline, setDeadline] = useState(task.deadline ? task.deadline.split("T")[0] : "");
  const [reminder, setReminder] = useState(task.reminderTime ? task.reminderTime.split("T")[1]?.slice(0, 5) ?? "" : "");
  const [priority, setPriority] = useState(task.weeklyPriorityId ? String(task.weeklyPriorityId) : "none");
  const [notes, setNotes] = useState(task.notes ?? "");

  const initialLinks = (() => {
    try {
      return task.linkRefs ? JSON.parse(task.linkRefs) : [];
    } catch {
      return [];
    }
  })();
  const [links, setLinks] = useState<string[]>(initialLinks);

  const initialFiles = (() => {
    try {
      return task.fileRefs ? JSON.parse(task.fileRefs) : [];
    } catch {
      return [];
    }
  })();
  const [fileRefs, setFileRefs] = useState<string[]>(initialFiles);
  const [newRef, setNewRef] = useState("");

  const [showNotes, setShowNotes] = useState(Boolean(task.notes));
  const [showLinks, setShowLinks] = useState(initialLinks.length > 0);
  const [showFiles, setShowFiles] = useState(initialFiles.length > 0);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setTag(task.tag ?? "");
    setDeadline(task.deadline ? task.deadline.split("T")[0] : "");
    setReminder(task.reminderTime ? task.reminderTime.split("T")[1]?.slice(0, 5) ?? "" : "");
    setPriority(task.weeklyPriorityId ? String(task.weeklyPriorityId) : "none");
    setNotes(task.notes ?? "");
    setShowNotes(Boolean(task.notes));
    try {
      const parsedLinks = task.linkRefs ? JSON.parse(task.linkRefs) : [];
      setLinks(parsedLinks);
      setShowLinks(parsedLinks.length > 0);
    } catch {
      setLinks([]);
      setShowLinks(false);
    }
    try {
      const parsedFiles = task.fileRefs ? JSON.parse(task.fileRefs) : [];
      setFileRefs(parsedFiles);
      setShowFiles(parsedFiles.length > 0);
    } catch {
      setFileRefs([]);
      setShowFiles(false);
    }
    setShowSubtaskInput(false);
  }, [task]);

  const saveCore = async (changes: Partial<{ title: string; tag: string; deadline: string; reminder: string; priority: string }>) => {
    await onUpdateTask(task.id, { title, tag, deadline, reminder, priority, ...changes });
  };

  const handleAddSubtask = async () => {
    await onAddSubtask(task.id, newSubtask);
    setNewSubtask("");
    setShowSubtaskInput(false);
  };

  const handleTitleSave = async () => {
    setEditingTitle(false);
    const newTitle = title.trim();
    if (newTitle && newTitle !== task.title) {
      await saveCore({ title: newTitle });
    } else {
      setTitle(task.title);
    }
  };

  const handleTagChange = async (v: string) => {
    setTag(v);
    await saveCore({ tag: v });
  };

  const handlePriorityChange = async (v: string) => {
    setPriority(v);
    await saveCore({ priority: v });
  };

  const handleDueSelect = async (d: Date | undefined) => {
    setDueOpen(false);
    if (d) {
      const formatted = formatISODate(d);
      setDeadline(formatted);
      await saveCore({ deadline: formatted });
    }
  };

  const handleDeadlineBlur = async () => {
    await saveCore({ deadline });
  };

  const handleReminderBlur = async () => {
    await saveCore({ reminder });
  };

  const handleNotesBlur = async () => {
    await updateTaskDetails(task.id, { notes: notes || null });
  };

  const saveLinks = async (items: string[]) => {
    await updateTaskDetails(task.id, {
      linkRefs: items.length ? JSON.stringify(items) : null,
    });
  };

  const handleLinkChange = (idx: number, value: string) => {
    setLinks((prev) => prev.map((l, i) => (i === idx ? value : l)));
  };

  const handleLinksBlur = async () => {
    const cleaned = links.map((l) => l.trim()).filter(Boolean);
    setLinks(cleaned);
    await saveLinks(cleaned);
  };

  const addLinkField = () => {
    setLinks((prev) => [...prev, ""]);
  };

  const removeLinkField = async (idx: number) => {
    const updated = links.filter((_, i) => i !== idx);
    setLinks(updated);
    await saveLinks(updated);
  };

  const addRef = async () => {
    if (!newRef.trim()) return;
    const updated = [...fileRefs, newRef.trim()];
    setFileRefs(updated);
    setNewRef("");
    await updateTaskDetails(task.id, {
      fileRefs: updated.length ? JSON.stringify(updated) : null,
    });
  };

  const removeRef = async (idx: number) => {
    const updated = fileRefs.filter((_, i) => i !== idx);
    setFileRefs(updated);
    await updateTaskDetails(task.id, {
      fileRefs: updated.length ? JSON.stringify(updated) : null,
    });
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
                <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={handleTitleSave} onKeyDown={(e) => e.key === "Enter" && handleTitleSave()} className="h-7 w-auto text-sm" autoFocus />
              ) : (
                <span className={`truncate ${task.done ? "line-through text-muted-foreground text-sm" : "font-medium text-sm"}`} onDoubleClick={() => setEditingTitle(true)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setEditingTitle(true)}>
                  {task.title}
                </span>
              )}
              {links.length > 0 && (
                <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Open link">
                  <a href={links[0]} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}

              {notes && <Badge variant="secondary">Note</Badge>}

              {task.hot && (
                <Badge className="gap-1 bg-orange-600/10 dark:bg-orange-500/20 text-orange-500">
                  <Flame className="h-3.5 w-3.5 animate-pulse text-yellow-500" />
                  Hot
                </Badge>
              )}

              {/* <Select defaultValue={task.tag ?? ""} onValueChange={handleTagChange}>
                <SelectTrigger size="sm" className="h-7 min-w-[120px] capitalize" aria-label="Select tag">
                  <SelectValue placeholder="Tag" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select> */}
              {tag && <Badge className="capitalize">{tags.find((t) => t.id === tag)?.name ?? tag}</Badge>}

              {task.priority && (
                <Select value={priority} onValueChange={handlePriorityChange}>
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

              {typeof task.count === "number" && <span className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs">{task.count}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Popover open={dueOpen} onOpenChange={setDueOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {deadline ? new Date(deadline).toLocaleDateString([], { month: "short", day: "numeric" }) : "Due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={deadline ? new Date(deadline) : undefined} onSelect={handleDueSelect} captionLayout="dropdown" />
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Task actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onDeleteTask(task.id)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <CollapsibleContent>
          <div className="mt-2 ml-12 space-y-2">
            <div className="flex flex-wrap gap-2">
              {!showNotes && (
                <Button className="font-normal text-xs" variant="link" size="sm" onClick={() => setShowNotes(true)}>
                  + Notes
                </Button>
              )}
              {!showLinks && (
                <Button
                  className="font-normal text-xs"
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setShowLinks(true);
                    if (links.length === 0) setLinks([""]);
                  }}
                >
                  + Link
                </Button>
              )}
              {!showFiles && (
                <Button className="font-normal text-xs" variant="link" size="sm" onClick={() => setShowFiles(true)}>
                  + File
                </Button>
              )}
              {!showSubtaskInput && (
                <Button className="font-normal text-xs" variant="link" size="sm" onClick={() => setShowSubtaskInput(true)}>
                  + Add Subtask
                </Button>
              )}
            </div>

            {showNotes && <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={handleNotesBlur} />}

            {showLinks && (
              <div className="space-y-2">
                {links.map((lnk, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input placeholder="Link" value={lnk} onChange={(e) => handleLinkChange(idx, e.target.value)} onBlur={handleLinksBlur} />
                    <Button variant="ghost" size="sm" onClick={() => removeLinkField(idx)}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button className="font-normal text-xs" variant="link" size="sm" onClick={addLinkField}>
                  + Add Link
                </Button>
              </div>
            )}

            {showFiles && (
              <div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add file reference"
                    value={newRef}
                    onChange={(e) => setNewRef(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRef();
                      }
                    }}
                  />
                  <Button onClick={addRef}>Add</Button>
                </div>
                {fileRefs.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {fileRefs.map((ref, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate">{ref}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeRef(idx)}>
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Label className="px-1">Tag</Label>
              <Select value={tag} onValueChange={handleTagChange}>
                <SelectTrigger className="h-9 w-full" aria-label="Select tag">
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
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="time-picker" className="px-1">
                Reminder
              </Label>
              <AlarmClockPlus />
              <Input id="time-picker" step="1" type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} onBlur={handleReminderBlur} className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none" />
            </div>

            <div className="flex gap-3">
              <Label className="px-1">Priority</Label>
              <Select value={priority} onValueChange={handlePriorityChange}>
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

            <ul className="space-y-2">
              {task.subtasks.map((sub: any) => (
                <li key={sub.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={sub.done} onCheckedChange={() => onToggleSubtask(sub.id, sub.done)} aria-label="Toggle subtask" />
                  <span className={`flex-1 truncate ${sub.done ? "line-through text-muted-foreground" : ""}`}>{sub.title}</span>
                  <Button variant="ghost" size="icon" aria-label="Delete subtask" onClick={() => onDeleteSubtask(sub.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
              {showSubtaskInput && (
                <li className="flex items-center gap-2">
                  <Input placeholder="Add subtask" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()} className="flex-1" />
                  <Button size="icon" onClick={handleAddSubtask} aria-label="Add subtask">
                    <Plus className="h-4 w-4" />
                  </Button>
                </li>
              )}
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
