import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectForm } from "@/components/projects/project-form";
import { LegacyMigrationCard } from "@/components/tasks/legacy-migration-card";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { toProjectFormClient } from "@/domain/projects/form-data";
import { listAccessibleProjects, listActiveProjectClients } from "@/domain/projects/service";
import { previewLegacyTaskMigration } from "@/domain/tasks/migration";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ProjectsPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/projects");
  const organizationId = await getActiveOrganizationId(actor);
  const [projects, clients, membership] = await Promise.all([
    listAccessibleProjects(actor, organizationId),
    listActiveProjectClients(actor, organizationId),
    new OrganizationRepository().getMembership(organizationId, actor.uid),
  ]);
  if (!projects || !membership) redirect("/");
  const active = projects.filter((project) => project.status !== "archived");
  const archived = projects.filter((project) => project.status === "archived");
  const isClient = membership.role === "client";
  const migrationPreview = isClient ? null : await previewLegacyTaskMigration(actor, organizationId);

  return <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
    <div><h1 className="text-3xl font-semibold tracking-tight">Projects</h1><p className="text-muted-foreground">{isClient ? "Projects shared with your client account." : "Create workspaces and choose the tools each project needs."}</p></div>
    <div className={membership.role === "admin" ? "grid gap-6 lg:grid-cols-[1fr_24rem]" : "grid gap-6"}>
      <section className="space-y-4"><h2 className="text-xl font-semibold">Current projects</h2>
        {active.length === 0 ? <Card><CardContent className="py-10 text-center text-muted-foreground">No current projects are available.</CardContent></Card> : <div className="grid gap-4 sm:grid-cols-2">{active.map((project) => <Link key={project.id} href={`/projects/${project.id}`}><Card className="h-full transition-colors hover:bg-muted/40"><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>{project.name}</CardTitle><Badge variant="outline">{project.key}</Badge></div><CardDescription className="capitalize">{project.status.replace("_", " ")}</CardDescription></CardHeader><CardContent><p className="line-clamp-2 text-sm text-muted-foreground">{project.description || "No description"}</p>{!isClient && <p className="mt-4 text-sm">{project.enabledTools.length} enabled tools</p>}</CardContent></Card></Link>)}</div>}
        {archived.length > 0 && <div className="space-y-3 pt-4"><h2 className="text-xl font-semibold">Archived</h2>{archived.map((project) => <Link key={project.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/40" href={`/projects/${project.id}`}><span>{project.name}</span><Badge variant="secondary">Archived</Badge></Link>)}</div>}
      </section>
      {membership.role === "admin" && <Card className="h-fit"><CardHeader><CardTitle>Create project</CardTitle><CardDescription>Starts blank with To-dos and Time tracking.</CardDescription></CardHeader><CardContent><ProjectForm clients={clients.map(toProjectFormClient)} /></CardContent></Card>}
    </div>
    {migrationPreview && <LegacyMigrationCard preview={migrationPreview} projects={active.filter((project) => project.status === "active" && project.enabledTools.includes("todos")).map(({ id, name, key }) => ({ id, name, key }))} />}
  </main>;
}
