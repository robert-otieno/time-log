"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Database, Loader2 } from "lucide-react";
import { migrateLegacyTasksAction } from "@/app/(app)/projects/migration-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MigrationPreview, MigrationResult } from "@/domain/tasks/migration";

export function LegacyMigrationCard({ preview, projects }: { preview: MigrationPreview; projects: Array<{ id: string; name: string; key: string }> }) {
  const [projectId, setProjectId] = useState(""); const [confirming, setConfirming] = useState(false); const [result, setResult] = useState<MigrationResult | null>(null); const [error, setError] = useState<string | null>(null); const [pending, startTransition] = useTransition();
  const sourceCount = preview.sourceTasks + preview.sourceSubtasks;
  const migrate = () => startTransition(async () => { setError(null); const response = await migrateLegacyTasksAction(projectId); if (!response.ok) setError(response.error); else { setResult(response.data); setConfirming(false); } });
  return <Card><CardHeader><div className="flex items-start gap-3"><div className="rounded-md border bg-muted/40 p-2"><Database className="size-5" /></div><div><CardTitle>Import legacy tasks</CardTitle><CardDescription>Copy your personal daily tasks into one project. Source records remain untouched.</CardDescription></div></div></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-3 text-sm sm:grid-cols-3"><Summary label="Tasks" value={preview.sourceTasks} /><Summary label="Subtasks" value={preview.sourceSubtasks} /><Summary label="Needs review" value={preview.skipped} /></div>
    {Object.keys(preview.unmappedFields).length > 0 && <p className="text-sm text-muted-foreground">Unmapped fields: {Object.entries(preview.unmappedFields).map(([field, count]) => `${field} (${count})`).join(", ")}.</p>}
    {sourceCount === 0 ? <p className="text-sm text-muted-foreground">No legacy tasks were found for this account.</p> : projects.length === 0 ? <p className="text-sm text-muted-foreground">Create or restore a project with To-dos enabled before importing.</p> : <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1 space-y-2"><Label htmlFor="migration-project">Target project</Label><Select value={projectId} onValueChange={setProjectId}><SelectTrigger id="migration-project"><SelectValue placeholder="Choose a project" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name} ({project.key})</SelectItem>)}</SelectContent></Select></div><Button disabled={!projectId || pending} onClick={() => setConfirming(true)}>Review import <ArrowRight /></Button></div>}
    {result && <div className="rounded-lg border bg-muted/30 p-4 text-sm"><p className="font-medium">Import {result.status === "pending" ? "partially complete" : result.status === "completed_with_issues" ? "complete with items to review" : "complete"}</p><p className="mt-1 text-muted-foreground">Created {result.created}; already imported {result.alreadyMigrated}; skipped {result.skipped}; conflicts {result.conflicts}; remaining {result.remaining}.</p>{result.remaining > 0 && <Button className="mt-3" size="sm" variant="outline" onClick={() => setConfirming(true)}>Continue import</Button>}</div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}><DialogContent><DialogHeader><DialogTitle>Import legacy tasks?</DialogTitle><DialogDescription>This copies valid tasks and subtasks into {projects.find((project) => project.id === projectId)?.name ?? "the selected project"}. Existing legacy records will not be changed or deleted.</DialogDescription></DialogHeader><div className="rounded-lg border bg-muted/30 p-4 text-sm"><p>{preview.validTasks} valid tasks and {preview.validSubtasks} valid subtasks are available.</p>{preview.skipped > 0 && <p className="mt-1 text-muted-foreground">{preview.skipped} records will be skipped and reported.</p>}</div><DialogFooter><Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>Cancel</Button><Button disabled={pending} onClick={migrate}>{pending ? <Loader2 className="animate-spin" /> : <Database />}{pending ? "Importing…" : "Import tasks"}</Button></DialogFooter></DialogContent></Dialog>
  </CardContent></Card>;
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-md border p-3"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-muted-foreground">{label}</p></div>; }
