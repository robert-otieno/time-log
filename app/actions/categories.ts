import { getCurrentUser } from "@/lib/auth";
import { userCol } from "@/lib/user-collection";
import type { Category } from "@/lib/types/categories";
import { deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, FieldValue } from "firebase/firestore";

const COL_CATEGORIES = "categories";

export async function getCategories(): Promise<Category[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const snap = await getDocs(userCol(user.uid, COL_CATEGORIES));
  return snap.docs.map((d) => ({ ...(d.data() as Category) }));
}

type AddCategoryInput = { name: string; color?: string | null };

export async function addCategory({ name, color }: AddCategoryInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const id = crypto.randomUUID();
  const ref = doc(userCol(user.uid, COL_CATEGORIES), id);
  const payload: Category = {
    id,
    name: name.trim(),
    color: color?.trim() ?? null,
    createdAt: serverTimestamp() as FieldValue,
    updatedAt: serverTimestamp() as FieldValue,
  };
  await setDoc(ref, payload);
  const snap = await getDoc(ref);
  return snap.data() as Category;
}

type CategoryPatch = { name?: string; color?: string | null };

export async function updateCategory(id: string, patch: CategoryPatch) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const payload: Record<string, unknown> = {};
  if (typeof patch.name === "string") payload.name = patch.name.trim();
  if (patch.color !== undefined) payload.color = patch.color === "" ? null : patch.color?.trim() ?? null;
  if (Object.keys(payload).length === 0) throw new Error("No valid fields to update.");
  const ref = doc(userCol(user.uid, COL_CATEGORIES), id);
  await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  const snap = await getDoc(ref);
  return snap.data() as Category;
}

export async function deleteCategory(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const ref = doc(userCol(user.uid, COL_CATEGORIES), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { deleted: false };
  await deleteDoc(ref);
  return { deleted: true };
}
