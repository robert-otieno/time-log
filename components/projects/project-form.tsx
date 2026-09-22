"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { createProjectAction, updateProjectAction, type ProjectActionState } from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AVAILABLE_PROJECT_TOOLS, isProjectToolAvailable } from "@/domain/projects/tools";
import type { ProjectFormClient, ProjectFormProject } from "@/domain/projects/form-data";

const initialState: ProjectActionState = { error: null, message: null };

export function ProjectForm({ clients, project, canManageClient = true }: { clients: ProjectFormClient[]; project?: ProjectFormProject; canManageClient?: boolean }) {
  const [state, action, pending] = useActionState(project ? updateProjectAction : createProjectAction, initialState);
  const [clientId, setClientId] = useState(project?.clientId ?? "none");
  const [tools, setTools] = useState((project?.enabledTools ?? ["todos", "time"]).filter(isProjectToolAvailable));
  const retainedDisabledTools = project?.enabledTools.filter((tool) => !isProjectToolAvailable(tool)) ?? [];
  return <form action={action} className="space-y-5">
    {project && <input type="hidden" name="projectId" value={project.id} />}
    <div className="space-y-2"><Label htmlFor="project-name">Project name</Label><Input id="project-name" name="name" defaultValue={project?.name} required maxLength={120} /></div>
    <div className="space-y-2"><Label htmlFor="project-description">Description</Label><Textarea id="project-description" name="description" defaultValue={project?.description ?? ""} maxLength={5000} /></div>
    <div className="space-y-2"><Label>Client company</Label><input type="hidden" name="clientId" value={clientId === "none" ? "" : clientId} /><Select value={clientId} onValueChange={setClientId} disabled={!canManageClient}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No client</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select>{!canManageClient && <p className="text-xs text-muted-foreground">Only an organization administrator can change the linked client.</p>}</div>
    <fieldset className="space-y-3"><legend className="text-sm font-medium">Enabled tools</legend><div className="grid gap-3 sm:grid-cols-2">{AVAILABLE_PROJECT_TOOLS.map((tool) => <label key={tool.id} className="flex items-center gap-2 rounded-md border p-3 text-sm"><Checkbox checked={tools.includes(tool.id)} onCheckedChange={(checked) => setTools((current) => checked ? [...current, tool.id] : current.filter((id) => id !== tool.id))} />{tool.label}</label>)}</div>{[...tools, ...retainedDisabledTools].map((tool) => <input key={tool} type="hidden" name="enabledTools" value={tool} />)}</fieldset>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state.message && <p role="status" className="text-sm text-muted-foreground">{state.message}</p>}
    <Button type="submit" disabled={pending || tools.length === 0}>{pending && <Loader2 className="animate-spin" />}{pending ? "Saving…" : project ? "Save changes" : "Create project"}</Button>
  </form>;
}
