"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskWithSubtasks, updateTaskDetails } from "@/app/actions/tasks";

interface TaskDetailsSheetProps {
  task:
    | (Pick<TaskWithSubtasks, "id" | "title" | "notes" | "link" | "fileRefs"> & {
        createdAt?: Date | null;
        updatedAt?: Date | null;
      })
    | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function TaskDetailsSheet({ task, open, onOpenChange, onSaved }: TaskDetailsSheetProps) {
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [fileRefs, setFileRefs] = useState<string[]>([]);
  const [newRef, setNewRef] = useState("");

  useEffect(() => {
    if (task) {
      setNotes(task.notes ?? "");
      setLink(task.link ?? "");
      try {
        setFileRefs(task.fileRefs ? JSON.parse(task.fileRefs) : []);
      } catch {
        setFileRefs([]);
      }
    }
  }, [task]);

  function addRef() {
    if (!newRef.trim()) return;
    setFileRefs((prev) => [...prev, newRef.trim()]);
    setNewRef("");
  }

  function removeRef(idx: number) {
    setFileRefs((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!task) return;
    await updateTaskDetails(task.id, {
      notes: notes || null,
      link: link || null,
      fileRefs: fileRefs.length ? JSON.stringify(fileRefs) : null,
    });
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{task?.title}</SheetTitle>
          {task?.createdAt && (
            <p className="text-xs text-muted-foreground">
              Created {task.createdAt.toLocaleString()}
              {task.updatedAt && ` • Updated ${task.updatedAt.toLocaleString()}`}
            </p>
          )}
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Input placeholder="Link" value={link} onChange={(e) => setLink(e.target.value)} />
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
        </div>
        <SheetFooter>
          <Button onClick={handleSave}>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
