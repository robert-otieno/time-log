"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { changeMembershipAccessAction } from "@/app/(app)/people/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function MembershipActions({ userId, status }: { userId: string; status: "invited" | "active" | "suspended" | "removed" }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (status === "removed") return null;
  const accessAction = status === "suspended" ? "restore" : "suspend";
  return <div className="flex justify-end gap-2">
    <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await changeMembershipAccessAction(userId, accessAction); if (!result.ok) setError(result.error); })}>{accessAction === "restore" ? "Restore" : "Suspend"}</Button>
    {status !== "suspended" && <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}><DialogTrigger asChild><Button size="sm" variant="ghost">Remove</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Remove organization access?</DialogTitle><DialogDescription>This ends access and removes active project assignments. A new invitation will be required to return.</DialogDescription></DialogHeader>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><DialogClose asChild><Button variant="outline" disabled={pending}>Cancel</Button></DialogClose><Button variant="destructive" disabled={pending} onClick={() => startTransition(async () => { setError(null); const result = await changeMembershipAccessAction(userId, "remove"); if (result.ok) setOpen(false); else setError(result.error); })}>{pending && <Loader2 className="animate-spin" />}{pending ? "Removing…" : "Remove access"}</Button></DialogFooter></DialogContent></Dialog>}
  </div>;
}
