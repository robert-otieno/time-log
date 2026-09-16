"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { LoaderCircle, Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { clientAuth } from "@/lib/firebase-client";
import { completeLogout } from "@/lib/logout";

export function LogoutButton() {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending) return;
    setOpen(nextOpen);
    if (nextOpen) setError(null);
  };

  const handleLogout = async () => {
    setIsPending(true);
    setError(null);

    try {
      await completeLogout({
        clearServerSession: async () => {
          const response = await fetch("/api/auth/logout", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          if (!response.ok) throw new Error("Server session logout failed");
        },
        signOutUser: () => signOut(clientAuth),
        clearLegacyToken: () => {
          document.cookie = "token=; path=/; max-age=0; SameSite=Lax";
        },
      });
      window.location.replace("/login");
    } catch {
      setError("We couldn’t log you out. Please try again.");
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="ml-2"
          aria-label="Log out"
          title="Log out"
        >
          <Power />
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Log out of Time Log?</DialogTitle>
          <DialogDescription>
            You’ll need to sign in again to access your projects and tasks.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleLogout} disabled={isPending}>
            {isPending && <LoaderCircle className="animate-spin" />}
            {isPending ? "Logging out…" : "Log out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
