"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { changeMembershipAccessAction } from "@/app/(app)/people/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function MembershipActions({ userId, status }: { userId: string; status: "invited" | "active" | "suspended" | "removed" }) {
  const [confirmation, setConfirmation] = useState<"suspend" | "remove" | null>(null); const [error, setError] = useState<string | null>(null); const [pending, startTransition] = useTransition();
  if (status === "removed") return null;
  const apply = (action: "suspend" | "restore" | "remove") => startTransition(async () => { setError(null); const result = await changeMembershipAccessAction(userId, action); if (result.ok) setConfirmation(null); else setError(result.error); });
  if (status === "suspended") return <div><Button size="sm" variant="outline" disabled={pending} onClick={() => apply("restore")}>{pending && <Loader2 className="animate-spin" />}{pending ? "Restoring…" : "Restore"}</Button>{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}</div>;
  return <div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirmation("suspend")}>Suspend</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmation("remove")}>Remove</Button><Dialog open={confirmation !== null} onOpenChange={(next) => !pending && !next && setConfirmation(null)}><DialogContent><DialogHeader><DialogTitle>{confirmation === "suspend" ? "Suspend organization access?" : "Remove organization access?"}</DialogTitle><DialogDescription>{confirmation === "suspend" ? "This person will immediately lose organization access. Their project assignments remain available for restoration." : "This ends access and removes active project assignments. Historical work remains attributed to this person, and a new invitation is required to return."}</DialogDescription></DialogHeader>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" disabled={pending} onClick={() => setConfirmation(null)}>Cancel</Button><Button variant="destructive" disabled={pending} onClick={() => confirmation && apply(confirmation)}>{pending && <Loader2 className="animate-spin" />}{pending ? "Saving…" : confirmation === "suspend" ? "Suspend access" : "Remove access"}</Button></DialogFooter></DialogContent></Dialog></div>;
}
