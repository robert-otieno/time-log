import { getCurrentUser } from "@/lib/auth";
import { userCol } from "@/lib/user-collection";
import type { Tag } from "@/lib/types/tags";
import { deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, FieldValue } from "firebase/firestore";

const COL_TAGS = "tags";

export async function getTags(): Promise<Tag[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const snap = await getDocs(userCol(user.uid, COL_TAGS));
  return snap.docs.map((d) => ({ ...(d.data() as Tag) }));
}

type AddTagInput = { name: string; color?: string | null };

export async function addTag({ name, color }: AddTagInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const id = crypto.randomUUID();
  const ref = doc(userCol(user.uid, COL_TAGS), id);
  const payload: Tag = {
    id,
    name: name.trim(),
    color: color?.trim() ?? null,
    createdAt: serverTimestamp() as FieldValue,
    updatedAt: serverTimestamp() as FieldValue,
  };
  await setDoc(ref, payload);
  const snap = await getDoc(ref);
  return snap.data() as Tag;
}

type TagPatch = { name?: string; color?: string | null };

export async function updateTag(id: string, patch: TagPatch) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const payload: Record<string, unknown> = {};
  if (typeof patch.name === "string") payload.name = patch.name.trim();
  if (patch.color !== undefined) payload.color = patch.color === "" ? null : patch.color?.trim() ?? null;
  if (Object.keys(payload).length === 0) throw new Error("No valid fields to update.");
  const ref = doc(userCol(user.uid, COL_TAGS), id);
  await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  const snap = await getDoc(ref);
  return snap.data() as Tag;
}

export async function deleteTag(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const ref = doc(userCol(user.uid, COL_TAGS), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { deleted: false };
  await deleteDoc(ref);
  return { deleted: true };
}
