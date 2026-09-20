import { notFound, redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProjectForm } from "@/components/projects/project-form";
import { ProjectStatusActions } from "@/components/projects/project-status-actions";
import {
  getAccessibleProject,
  listActiveProjectClients,
} from "@/domain/projects/service";
import {
  toProjectFormClient,
  toProjectFormProject,
} from "@/domain/projects/form-data";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/projects");
  const { projectId } = await params;
  const organizationId = await getActiveOrganizationId(actor);
  const access = await getAccessibleProject(actor, organizationId, projectId);
  if (!access || access.role !== "admin") notFound();
  const clients = await listActiveProjectClients(actor, organizationId);
  const projectFormData = toProjectFormProject(access.project);
  const clientOptions = clients.map(toProjectFormClient);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {access.project.status === "active" ? (
        <Card>
          <CardHeader>
            <CardTitle>Project settings</CardTitle>
            {/* <CardDescription>
              The project key {access.project.key} is permanent.
            </CardDescription> */}
          </CardHeader>
          <CardContent>
            <ProjectForm clients={clientOptions} project={projectFormData} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Project settings are read-only</CardTitle>
            <CardDescription>
              Restore the project to Active before changing its name, client,
              description, or enabled tools.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Lifecycle</CardTitle>
          <CardDescription>
            Current status: {access.project.status.replace("_", " ")}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectStatusActions
            projectId={projectId}
            status={access.project.status}
          />
        </CardContent>
      </Card>
    </div>
  );
}
