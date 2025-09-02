import { clientAuth } from "@/lib/firebase-client";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";

export type User = FirebaseUser | null;

// Ensures we wait for Firebase Auth to initialize on first load
export async function getCurrentUser(): Promise<User> {
  if (clientAuth.currentUser !== null) return clientAuth.currentUser;
  return new Promise<User>((resolve) => {
    const unsub = onAuthStateChanged(
      clientAuth,
      (u) => {
        unsub();
        resolve(u ?? null);
      },
      () => {
        unsub();
        resolve(null);
      }
    );
  });
}
