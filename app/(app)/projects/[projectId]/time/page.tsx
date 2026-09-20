import { notFound, redirect } from "next/navigation";
import { TimerStartButton } from "@/components/time/timer-start-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessibleProject } from "@/domain/projects/service";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ProjectTimePage({ params }: { params: Promise<{ projectId: string }> }) {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/projects");
  const { projectId } = await params;
  const organizationId = await getActiveOrganizationId(actor);
  const access = await getAccessibleProject(actor, organizationId, projectId);
  if (!access || access.role === "client" || !access.project.enabledTools.includes("time")) notFound();
  return <Card><CardHeader><CardTitle>Time tracking</CardTitle><CardDescription>Start work against a saved task. The active timer remains visible while you move through Time Log.</CardDescription></CardHeader><CardContent className="space-y-3"><TimerStartButton projectId={projectId} label="Start project timer" variant="default" /><p className="text-sm text-muted-foreground">Stopping timers and reviewing completed time entries arrives in the next feature.</p></CardContent></Card>;
}
