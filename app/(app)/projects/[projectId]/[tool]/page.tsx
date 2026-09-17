import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAvailableClientTools } from "@/domain/projects/client-tools";
import { getAccessibleProject } from "@/domain/projects/service";
import { PROJECT_TOOLS, projectToolFromPath } from "@/domain/projects/tools";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ProjectToolPage({ params }: { params: Promise<{ projectId: string; tool: string }> }) {
  const actor = await getSessionActor(); if (!actor) redirect("/login?next=/projects"); const { projectId, tool: path } = await params; const tool = projectToolFromPath(path); if (!tool) notFound();
  const organizationId = await getActiveOrganizationId(actor); const access = await getAccessibleProject(actor, organizationId, projectId); if (!access || !access.project.enabledTools.includes(tool)) notFound();
  if (access.role === "client" && !(await listAvailableClientTools(organizationId, projectId, [tool])).includes(tool)) notFound();
  const definition = PROJECT_TOOLS.find((item) => item.id === tool)!;
  return <Card><CardHeader><CardTitle>{definition.label}</CardTitle><CardDescription>This tool is enabled for {access.project.name}.</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">Its project-scoped workflow will be implemented in the corresponding build-plan feature.</p></CardContent></Card>;
}
