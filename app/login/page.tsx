"use client";

import { useEffect } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";

import { auth } from "@/db";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  const user = auth.currentUser;
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      document.cookie = `token=${token}; path=/`;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoginForm signIn={signIn} />
    </div>
  );
}
