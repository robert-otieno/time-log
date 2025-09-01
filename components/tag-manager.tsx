"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { useTags } from "@/hooks/use-tags";

interface TagManagerProps {
  onTagsUpdated?: () => Promise<void> | void;
}

export default function TagManager({ onTagsUpdated }: TagManagerProps) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const { tags, addTag, updateTag, deleteTag, loadTags } = useTags();

  async function handleAdd() {
    if (!newTag.trim()) return;
    await addTag(newTag.trim());
    setNewTag("");
    await loadTags();
    await onTagsUpdated?.();
  }

  async function handleUpdate(id: string, name: string) {
    if (!name.trim()) return;
    await updateTag(id, { name: name.trim() });
    await loadTags();
    await onTagsUpdated?.();
  }

  async function handleDelete(id: string) {
    await deleteTag(id);
    await loadTags();
    await onTagsUpdated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size={"sm"} className="text-xs font-medium w-full">
          Add tag
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>Add, rename, or remove tags to better organize your tasks.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="New tag name" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
            <Button onClick={handleAdd}>Add</Button>
          </div>
          <ul className="space-y-2">
            {tags.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <Input
                  defaultValue={t.name}
                  onBlur={(e) => {
                    if (e.target.value !== t.name) {
                      handleUpdate(t.id, e.target.value);
                    }
                  }}
                />
                <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} aria-label="Delete tag">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
