import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addCategory, deleteCategory, getCategories, updateCategory } from "@/app/actions/categories";
import type { Category } from "@/lib/types/categories";
import { defaultCategories } from "@/lib/tasks";

export function useCategories() {
  const [userCategories, setUserCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCategories() {
    try {
      const res = await getCategories();
      setUserCategories(res);
      setError(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load categories");
      setError("Failed to load categories");
    }
  }

  async function addNewCategory(name: string, color?: string | null) {
    if (!name.trim()) return;
    try {
      const res = await addCategory({ name, color });
      setUserCategories((prev) => [...prev, res]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add category");
    }
  }

  async function updateExistingCategory(id: string, values: { name?: string; color?: string | null }) {
    try {
      const res = await updateCategory(id, values);
      setUserCategories((prev) => prev.map((c) => (c.id === id ? res : c)));
    } catch (err) {
      console.error(err);
      toast.error("Failed to update category");
    }
  }

  async function removeCategory(id: string) {
    try {
      await deleteCategory(id);
      setUserCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete category");
    }
  }

  const categories = [...defaultCategories, ...userCategories];

  return {
    categories,
    userCategories,
    error,
    loadCategories,
    addCategory: addNewCategory,
    updateCategory: updateExistingCategory,
    deleteCategory: removeCategory,
  };
}

export type { Category };
