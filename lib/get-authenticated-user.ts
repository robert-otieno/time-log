import { onAuthStateChanged, User } from "firebase/auth";
import { clientAuth } from "@/lib//firebase-client";

export async function getUserIdFromRequest(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(clientAuth, (user) => {
      resolve(user);
      unsub();
    });
  });
}
