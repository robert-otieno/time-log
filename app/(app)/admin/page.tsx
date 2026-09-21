import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Building2, FolderKanban, Users } from "lucide-react";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { loadAdminConsole } from "@/domain/admin/read";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";
import { OrganizationSettingsForm } from "@/components/admin/organization-settings-form";
import { MemberAdminControls } from "@/components/admin/member-admin-controls";
import { MembershipActions } from "@/components/people/membership-actions";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, statusTone } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function auditLabel(action: string) {
  return action
    .split(".")
    .slice(1)
    .join(" ")
    .replaceAll("membership", "member");
}

export default async function AdminPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/admin");
  const organizationId = await getActiveOrganizationId(actor);
  const data = await loadAdminConsole(
    actor,
    organizationId,
    createRequestCorrelation(),
  );
  if (!data) redirect("/");
  const activeMembers = data.members.filter(
    (member) => member.status === "active",
  );
  const activeProjects = data.projects.filter(
    (project) => project.status === "active",
  );
  const clientNames = new Map(
    data.clients.map((client) => [client.id, client.name]),
  );
  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Administration</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {data.organization.name}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage organization access, project assignments, and workspace
            settings.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/activity">View activity</Link>
        </Button>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Users className="size-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {activeMembers.length}
              </p>
              <p className="text-sm text-muted-foreground">Active people</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Building2 className="size-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {
                  data.clients.filter((client) => client.status === "active")
                    .length
                }
              </p>
              <p className="text-sm text-muted-foreground">Active clients</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <FolderKanban className="size-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {activeProjects.length}
              </p>
              <p className="text-sm text-muted-foreground">Active projects</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Activity className="size-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {data.pendingInvitations.length}
              </p>
              <p className="text-sm text-muted-foreground">
                Pending invitations
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
            <CardTitle>People and project access</CardTitle>
            <CardDescription>
              Roles control organization capabilities; assignments control
              project access.
            </CardDescription>
            <CardAction>
              <Button asChild variant="outline">
                <Link href="/people">Invite people</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.members.map((member) => {
              const memberAssignments = data.assignments.filter(
                (assignment) =>
                  assignment.userId === member.userId &&
                  assignment.status === "active",
              );
              const displayRole =
                member.role === "admin"
                  ? "Organization admin"
                  : member.role === "member" &&
                      memberAssignments.some(
                        (assignment) => assignment.projectRole === "admin",
                      )
                    ? "Project admin"
                    : member.role;
              return (
                <div key={member.userId} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {member.displayName ??
                          member.email ??
                          "Organization user"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.email ?? member.userId}
                        {member.clientId
                          ? ` · ${clientNames.get(member.clientId) ?? "Client"}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {displayRole}
                      </Badge>
                      <StatusBadge tone={statusTone(member.status)} className="capitalize">
                        {member.status}
                      </StatusBadge>
                      {member.userId !== actor.uid && (
                        <MembershipActions
                          userId={member.userId}
                          status={member.status}
                        />
                      )}
                    </div>
                  </div>
                  <MemberAdminControls
                    userId={member.userId}
                    role={member.role}
                    status={member.status}
                    clientId={member.clientId}
                    projects={data.projects.map(
                      ({ id, name, status, clientId }) => ({
                        id,
                        name,
                        status,
                        clientId,
                      }),
                    )}
                    assignments={memberAssignments.map(
                      ({ projectId, projectRole }) => ({
                        projectId,
                        projectRole,
                      }),
                    )}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Organization settings</CardTitle>
            <CardDescription>
              Timezone changes affect reporting boundaries without rewriting
              stored timestamps.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationSettingsForm
              initialName={data.organization.name}
              initialTimezone={data.organization.timezone}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
          <CardTitle>Clients</CardTitle>
          <CardDescription>
            Client companies, their guest users, and linked projects.
          </CardDescription>
          <CardAction>
            <Button asChild variant="outline">
              <Link href="/people">Invite a client</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {data.clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No client companies yet.
            </p>
          ) : (
            data.clients.map((client) => {
              const clientProjects = data.projects.filter(
                (project) => project.clientId === client.id,
              );
              const clientUsers = data.members.filter(
                (member) => member.clientId === client.id,
              );
              return (
                <div key={client.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{client.name}</p>
                    <StatusBadge tone={statusTone(client.status)} className="capitalize">
                      {client.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {clientUsers.length} guest{" "}
                    {clientUsers.length === 1 ? "user" : "users"} ·{" "}
                    {clientProjects.length} linked{" "}
                    {clientProjects.length === 1 ? "project" : "projects"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {clientProjects.map((project) => (
                      <Button
                        key={project.id}
                        asChild
                        size="sm"
                        variant="outline"
                      >
                        <Link href={`/projects/${project.id}/settings`}>
                          {project.name}
                        </Link>
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              Open canonical project settings for tools, clients, and lifecycle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {project.key}
                    {project.clientId
                      ? ` · ${clientNames.get(project.clientId) ?? "Client"}`
                      : " · Internal"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={statusTone(project.status)} className="capitalize">
                    {project.status.replace("_", " ")}
                  </StatusBadge>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/projects/${project.id}/settings`}>
                      Settings
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
            <CardTitle>Recent administration</CardTitle>
            <CardDescription>
              The complete searchable activity viewer follows in Feature 22.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No administrative history yet.
              </p>
            ) : (
              data.recentAudit.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {auditLabel(event.action)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {event.actor.id} · {event.outcome}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en-US", {
                      timeZone: data.organization.timezone,
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(event.occurredAt.seconds * 1000))}
                  </time>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
