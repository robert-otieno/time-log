import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessibleProject } from "@/domain/projects/service";
import { PROJECT_TOOLS } from "@/domain/projects/tools";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const actor = await getSessionActor(); if (!actor) redirect("/login?next=/projects"); const { projectId } = await params; const access = await getAccessibleProject(actor, await getActiveOrganizationId(actor), projectId); if (!access) notFound();
  return <div className="space-y-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Project overview</h2><p className="text-muted-foreground">{access.project.description || "No project description yet."}</p></div>{access.role === "admin" && <Button asChild variant="outline"><Link href={`/projects/${projectId}/settings`}><Settings />Settings</Link></Button>}</div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{PROJECT_TOOLS.filter((tool) => access.project.enabledTools.includes(tool.id)).map((tool) => <Link key={tool.id} href={`/projects/${projectId}/${tool.path}`}><Card className="h-full transition-colors hover:bg-muted/40"><CardHeader><CardTitle>{tool.label}</CardTitle><CardDescription>Open this project tool.</CardDescription></CardHeader><CardContent><span className="text-sm text-primary">Open →</span></CardContent></Card></Link>)}</div></div>;
}
