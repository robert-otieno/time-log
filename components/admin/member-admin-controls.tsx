"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { changeMemberRoleAction, changeProjectAssignmentAction } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Project = { id: string; name: string; status: string; clientId: string | null };
type DisplayRole = "admin" | "project_admin" | "member";
type Assignment = { projectId: string; projectRole: "admin" | "member" };

export function MemberAdminControls({ userId, role, status, clientId, projects, assignments }: {
  userId: string;
  role: "admin" | "member" | "client";
  status: string;
  clientId: string | null;
  projects: Project[];
  assignments: Assignment[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ kind: "role" | "remove"; projectId?: string; role?: DisplayRole } | null>(null);
  if (status !== "active") return null;

  const assignedProjectIds = assignments.map(({ projectId }) => projectId);
  const adminProjectIds = assignments.filter(({ projectRole }) => projectRole === "admin").map(({ projectId }) => projectId);
  const displayRole: DisplayRole = role === "admin" ? "admin" : adminProjectIds.length > 0 ? "project_admin" : "member";
  const eligible = projects.filter((project) => role !== "client" || (clientId && project.clientId === clientId));
  const selectedCount = assignments.filter((assignment) => eligible.some((project) => project.id === assignment.projectId)).length;

  const applyRole = (nextRole: DisplayRole) => startTransition(async () => {
    setError(null);
    const projectIds = nextRole === "project_admin" ? assignedProjectIds : adminProjectIds;
    const result = await changeMemberRoleAction({ userId, role: nextRole, projectIds });
    if (result.ok) setConfirmation(null); else setError(result.error);
  });

  const changeAssignment = (projectId: string, action: "assign" | "remove") => startTransition(async () => {
    setError(null);
    const result = await changeProjectAssignmentAction({
      userId,
      projectId,
      action,
      projectRole: displayRole === "project_admin" ? "admin" : "member",
    });
    if (result.ok) setConfirmation(null); else setError(result.error);
  });

  return <div className="space-y-3 border-t pt-3">
    {role !== "client" && <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <span className="block text-sm text-muted-foreground">Role</span>
        <Select value={displayRole} disabled={pending} onValueChange={(value: DisplayRole) => {
          if (value === displayRole) return;
          if (value === "project_admin" && assignedProjectIds.length === 0) {
            setError("Select at least one project before choosing Project admin.");
            return;
          }
          setConfirmation({ kind: "role", role: value });
        }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="project_admin">Project admin</SelectItem><SelectItem value="admin">Organization admin</SelectItem></SelectContent>
        </Select>
      </div>

      <div className="space-y-2 sm:text-right">
        <span className="block text-sm text-muted-foreground">Project access</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full min-w-48 justify-between sm:w-auto" disabled={pending || eligible.length === 0}>
              {eligible.length === 0 ? "No active projects" : selectedCount === 0 ? "Select projects" : `${selectedCount} project${selectedCount === 1 ? "" : "s"} selected`}
              {pending ? <Loader2 className="animate-spin" /> : <ChevronDown />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Select projects</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {eligible.map((project) => {
              const assignment = assignments.find(({ projectId }) => projectId === project.id);
              return <DropdownMenuCheckboxItem
                key={project.id}
                checked={Boolean(assignment)}
                disabled={pending || (!assignment && project.status === "archived")}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => checked ? changeAssignment(project.id, "assign") : setConfirmation({ kind: "remove", projectId: project.id })}
              >
                <span className="min-w-0 flex-1 truncate text-left">{project.name}</span>
                {assignment?.projectRole === "admin" && <span className="text-xs text-muted-foreground">Admin</span>}
              </DropdownMenuCheckboxItem>;
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {displayRole === "admin" && <p className="text-xs text-muted-foreground">Selections apply if converted to Project admin.</p>}
      </div>
    </div>}

    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={confirmation !== null} onOpenChange={(next) => !pending && !next && setConfirmation(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirmation?.kind === "role" ? "Change administrative access?" : "Remove project access?"}</DialogTitle>
          <DialogDescription>{confirmation?.kind === "role" ? confirmation.role === "project_admin" ? "This person will lose organization-wide access and administer only their assigned projects." : confirmation.role === "admin" ? "Organization administrators can access every project, including personal projects." : "This person will retain ordinary access to assigned projects without administrative settings." : "Access ends immediately. Historical tasks, time entries, and audit attribution remain unchanged."}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setConfirmation(null)}>Cancel</Button>
          <Button variant={confirmation?.kind === "remove" ? "destructive" : "default"} disabled={pending} onClick={() => confirmation?.kind === "role" ? applyRole(confirmation.role!) : changeAssignment(confirmation!.projectId!, "remove")}>
            {pending && <Loader2 className="animate-spin" />}{pending ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
