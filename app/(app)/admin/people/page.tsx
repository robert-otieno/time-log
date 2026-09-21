import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InvitePersonForm } from "@/components/people/invite-person-form";
import { MembershipActions } from "@/components/people/membership-actions";
import { MemberAdminControls } from "@/components/admin/member-admin-controls";
import { listPeopleAdminData } from "@/domain/people/repository";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/admin/people");
  const data = await listPeopleAdminData(
    await getActiveOrganizationId(actor),
    actor.uid,
  );
  if (!data) redirect("/");
  const inviteStatus = (await searchParams).invite;
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <p className="text-sm font-medium text-primary">Administration</p>
        <h1 className="text-3xl font-semibold tracking-tight">People</h1>
        <p className="text-muted-foreground">
          Manage members, clients, invitations, and project access.
        </p>
      </div>
      {inviteStatus && (
        <div
          role="status"
          className="rounded-lg border bg-muted/40 p-4 text-sm"
        >
          {inviteStatus === "sent"
            ? "Invitation sent."
            : inviteStatus === "queued"
              ? "Invitation saved, but delivery needs to be retried."
              : "The invitation could not be created. Check the details and try again."}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Organization access</CardTitle>
            <CardDescription>
              Active and historical memberships.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.members.map((member) => {
              const assignments = data.assignments.filter(
                (assignment) =>
                  assignment.userId === member.userId &&
                  assignment.status === "active",
              );
              const displayRole =
                member.role === "admin"
                  ? "Organization admin"
                  : member.role === "member" &&
                      assignments.some(
                        (assignment) => assignment.projectRole === "admin",
                      )
                    ? "Project admin"
                    : member.role;
              return (
                <div
                  key={member.userId}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {member.displayName ||
                          member.email ||
                          "Organization user"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.email || member.userId}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {displayRole}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {member.status}
                      </Badge>
                      {member.userId !== actor.uid && (
                        <MembershipActions
                          userId={member.userId}
                          status={member.status}
                        />
                      )}
                    </div>
                  </div>
                  {member.userId !== actor.uid && (
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
                      assignments={assignments.map(
                        ({ projectId, projectRole }) => ({
                          projectId,
                          projectRole,
                        }),
                      )}
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Invite someone</CardTitle>
            <CardDescription>
              Invitation links expire after seven days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvitePersonForm
              clients={data.clients
                .filter((client) => client.status === "active")
                .map(({ id, name }) => ({ id, name }))}
              projects={data.projects.map(({ id, name }) => ({ id, name }))}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invitations yet.</p>
          ) : (
            data.invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {invitation.role === "admin"
                      ? "Organization admin"
                      : invitation.role === "project_admin"
                        ? "Project admin"
                        : invitation.role === "client"
                          ? "Client"
                          : "Member"}{" "}
                    · {invitation.projectIds.length} projects
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {invitation.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
