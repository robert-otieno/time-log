"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { invitePersonAction } from "@/app/(app)/admin/people/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { id: string; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{pending ? "Sending…" : "Send invitation"}</Button>;
}

export function InvitePersonForm({ clients, projects }: { clients: Option[]; projects: Option[] }) {
  const [role, setRole] = useState("member");
  const [clientId, setClientId] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  return <form action={invitePersonAction} className="space-y-4">
    <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
    <div className="space-y-2"><Label>Role</Label><input type="hidden" name="role" value={role} /><Select value={role} onValueChange={setRole}><SelectTrigger className="w-full" aria-label="Invitation role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="project_admin">Project admin</SelectItem><SelectItem value="admin">Organization admin</SelectItem><SelectItem value="client">Client</SelectItem></SelectContent></Select>{role === "admin" && <p className="text-xs text-muted-foreground">Organization admins can access every project. Project selections do not restrict them.</p>}{role === "project_admin" && <p className="text-xs text-muted-foreground">Project admins can manage only the projects selected below.</p>}</div>
    {role === "client" && <div className="space-y-4 rounded-lg border bg-muted/30 p-4"><p className="text-sm font-medium">Client company</p><div className="space-y-2"><Label>Existing company</Label><input type="hidden" name="clientId" value={clientId} /><Select value={clientId} onValueChange={setClientId}><SelectTrigger className="w-full" aria-label="Existing client company"><SelectValue placeholder="Select a company" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="newClientName">Or create a company</Label><Input id="newClientName" name="newClientName" placeholder="Company name" /></div></div>}
    <fieldset className="space-y-2"><legend className="text-sm font-medium">Project access</legend>{projects.length === 0 ? <p className="text-sm text-muted-foreground">No active projects are available.</p> : projects.map((project) => <label key={project.id} className="flex items-center gap-2 text-sm"><Checkbox checked={projectIds.includes(project.id)} onCheckedChange={(checked) => setProjectIds((current) => checked ? [...current, project.id] : current.filter((id) => id !== project.id))} />{project.name}</label>)}{projectIds.map((id) => <input key={id} type="hidden" name="projectIds" value={id} />)}</fieldset>
    <SubmitButton />
  </form>;
}
