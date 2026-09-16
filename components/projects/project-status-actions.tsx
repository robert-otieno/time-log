"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { changeProjectStatusAction } from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Status = "active" | "on_hold" | "completed" | "archived";
const labels: Record<Status, string> = { active: "Restore to active", on_hold: "Put on hold", completed: "Mark completed", archived: "Archive project" };

export function ProjectStatusActions({ projectId, status }: { projectId: string; status: Status }) {
  const [target, setTarget] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options: Status[] = status === "archived" ? ["active"] : status === "active" ? ["on_hold", "completed", "archived"] : ["active", "archived"];
  return <div className="space-y-3"><div className="flex flex-wrap gap-2">{options.map((option) => <Button key={option} variant={option === "archived" ? "outline" : option === "active" ? "default" : "outline"} onClick={() => { setError(null); setTarget(option); }}>{labels[option]}</Button>)}</div>
    <Dialog open={target !== null} onOpenChange={(open) => !pending && !open && setTarget(null)}><DialogContent><DialogHeader><DialogTitle>{target ? labels[target] : "Change project status"}?</DialogTitle><DialogDescription>{target === "archived" ? "The project becomes read-only and leaves the default project list." : target === "active" ? "Ordinary project work and settings become available again." : "The project remains available for reference but becomes read-only."}</DialogDescription></DialogHeader>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><DialogClose asChild><Button variant="outline" disabled={pending}>Cancel</Button></DialogClose><Button variant={target === "archived" ? "destructive" : "default"} disabled={pending || !target} onClick={() => target && startTransition(async () => { const result = await changeProjectStatusAction(projectId, target); if (result.ok) setTarget(null); else setError(result.error); })}>{pending && <Loader2 className="animate-spin" />}{pending ? "Saving…" : "Confirm"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
