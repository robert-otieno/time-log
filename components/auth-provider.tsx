"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";

import { auth } from "@/db";

interface AuthContextValue {
  user: User | null;
}

const AuthContext = createContext<AuthContextValue>({ user: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser && pathname !== "/login") {
        router.push("/login");
      } else if (firebaseUser && pathname === "/login") {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router, pathname]);

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
