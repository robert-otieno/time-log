import { notFound, redirect } from "next/navigation";
import { ProjectFiles } from "@/components/files/project-files";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listProjectFiles } from "@/domain/files/service";
import { getAccessibleProject } from "@/domain/projects/service";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ProjectDocsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const actor = await getSessionActor(); if (!actor) redirect("/login?next=/projects"); const { projectId } = await params; const organizationId = await getActiveOrganizationId(actor); const access = await getAccessibleProject(actor, organizationId, projectId);
  if (!access || !access.project.enabledTools.includes("docs")) notFound();
  const result = await listProjectFiles(actor, organizationId, projectId);
  return <Card><CardHeader><CardTitle>Docs & files</CardTitle><CardDescription>Private project files with controlled client visibility.</CardDescription></CardHeader><CardContent><ProjectFiles projectId={projectId} initialFiles={result.files} canUpload={result.canUpload && access.project.status === "active"} /></CardContent></Card>;
}
