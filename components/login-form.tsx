"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { safeReturnPath } from "@/lib/auth-session";
import { clientAuth } from "@/lib/firebase-client";

export function LoginForm({ returnPath }: { returnPath: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const signIn = async () => {
    setIsPending(true);
    setError(null);

    try {
      const credential = await signInWithPopup(clientAuth, new GoogleAuthProvider());
      const idToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Sign-in could not be completed.");
      }

      router.replace(safeReturnPath(returnPath));
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message.startsWith("Please sign in")
          ? cause.message
          : "Sign-in failed. Please try again.",
      );
      setIsPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Time Log</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access your projects, tasks, and time entries.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          variant="outline"
          onClick={signIn}
          type="button"
          className="w-full"
          disabled={isPending}
        >
          {isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
          )}
          {isPending ? "Signing in…" : "Continue with Google"}
        </Button>
      </div>
    </div>
  );
}
