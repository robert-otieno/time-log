import { notFound, redirect } from "next/navigation";
import { TimerStartButton } from "@/components/time/timer-start-button";
import { ProjectTimeEntries } from "@/components/time/project-time-entries";
import { loadProjectTimeData } from "@/app/(app)/timer-actions";
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
  const data = await loadProjectTimeData(projectId); if (!data) notFound();
  return <div className="space-y-6"><Card><CardHeader><CardTitle>Time tracking</CardTitle><CardDescription>Start work against a saved task. The active timer remains visible while you move through Time Log.</CardDescription></CardHeader><CardContent><TimerStartButton projectId={projectId} label="Start project timer" variant="default" /></CardContent></Card><ProjectTimeEntries projectId={projectId} role={data.role} tasks={data.tasks} entries={data.entries} /></div>;
}
