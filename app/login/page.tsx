"use client";

import { useEffect } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";

import { auth } from "@/db";
import { useAuth } from "@/components/auth-provider";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    router.push("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoginForm signIn={signIn} />
    </div>
  );
}
