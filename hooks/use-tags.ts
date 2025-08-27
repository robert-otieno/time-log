import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addTag, deleteTag, getTags, updateTag } from "@/app/actions/tags";
import type { Tag } from "@/lib/types/tags";

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTags() {
    try {
      const res = await getTags();
      setTags(res);
      setError(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load tags");
      setError("Failed to load tags");
    }
  }

  async function addNewTag(name: string, color?: string | null) {
    if (!name.trim()) return;
    try {
      const res = await addTag({ name, color });
      setTags((prev) => [...prev, res]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add tag");
    }
  }

  async function updateExistingTag(id: string, values: { name?: string; color?: string | null }) {
    try {
      const res = await updateTag(id, values);
      setTags((prev) => prev.map((t) => (t.id === id ? res : t)));
    } catch (err) {
      console.error(err);
      toast.error("Failed to update tag");
    }
  }

  async function removeTag(id: string) {
    try {
      await deleteTag(id);
      setTags((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete tag");
    }
  }

  return { tags, error, loadTags, addTag: addNewTag, updateTag: updateExistingTag, deleteTag: removeTag };
}

export type { Tag };
