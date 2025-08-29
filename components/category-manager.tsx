"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { useCategories } from "@/hooks/use-categories";

interface CategoryManagerProps {
  onCategoriesUpdated?: () => Promise<void> | void;
}

export default function CategoryManager({ onCategoriesUpdated }: CategoryManagerProps) {
  const [open, setOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const { userCategories, addCategory, updateCategory, deleteCategory, loadCategories } = useCategories();

  async function handleAdd() {
    if (!newCategory.trim()) return;
    await addCategory(newCategory.trim());
    setNewCategory("");
    await loadCategories();
    await onCategoriesUpdated?.();
  }

  async function handleUpdate(id: string, name: string) {
    if (!name.trim()) return;
    await updateCategory(id, { name: name.trim() });
    await loadCategories();
    await onCategoriesUpdated?.();
  }

  async function handleDelete(id: string) {
    await deleteCategory(id);
    await loadCategories();
    await onCategoriesUpdated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9">
          Add category
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
          <DialogDescription>Add, rename, or remove categories to better organize your goals.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            <Button onClick={handleAdd}>Add</Button>
          </div>
          <ul className="space-y-2">
            {userCategories.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Input
                  defaultValue={c.name}
                  onBlur={(e) => {
                    if (e.target.value !== c.name) {
                      handleUpdate(c.id, e.target.value);
                    }
                  }}
                />
                <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} aria-label="Delete category">
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
