import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ClientPortalBanner } from "@/components/projects/client-portal-banner";
import { ProjectToolNav } from "@/components/projects/project-tool-nav";
import { listAvailableClientTools } from "@/domain/projects/client-tools";
import { getAccessibleProject } from "@/domain/projects/service";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const actor = await getSessionActor(); if (!actor) redirect("/login?next=/projects"); const { projectId } = await params;
  const organizationId = await getActiveOrganizationId(actor); const access = await getAccessibleProject(actor, organizationId, projectId); if (!access) notFound();
  const availableTools = access.role === "client" ? await listAvailableClientTools(organizationId, projectId, access.project.enabledTools) : access.project.enabledTools;
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"><header className="space-y-4"><div className="flex flex-wrap items-center gap-3"><div><p className="text-sm font-medium text-primary">{access.project.key}</p><h1 className="text-3xl font-semibold tracking-tight">{access.project.name}</h1></div><Badge variant={access.project.status === "active" ? "secondary" : "outline"} className="capitalize">{access.project.status.replace("_", " ")}</Badge></div>{access.role === "client" && <ClientPortalBanner />}<ProjectToolNav projectId={projectId} availableTools={availableTools} /></header>{access.project.status !== "active" && <div className="rounded-lg border bg-muted/40 p-4 text-sm">This project is {access.project.status.replace("_", " ")} and is read-only until an administrator restores it.</div>}{children}</main>;
}
