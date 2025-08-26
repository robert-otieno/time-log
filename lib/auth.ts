import { auth } from "@/db";
import type { User as FirebaseUser } from "firebase/auth";

export type User = FirebaseUser | null;
export async function getCurrentUser(): Promise<User> {
  return auth.currentUser;
}
