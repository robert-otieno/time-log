"use client";

import { ReactNode, createContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { clientAuth } from "@/lib/firebase-client";

export const AuthContext = createContext<FirebaseUser | null | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, setUser);
    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
