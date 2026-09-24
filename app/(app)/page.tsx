import { redirect } from "next/navigation";
import { MyWork } from "@/components/tasks/my-work";
import { loadMyWork } from "@/domain/tasks/my-work";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";
import { loadWorkDashboard } from "@/domain/work-dashboard/service";
import { WorkDashboard } from "@/components/work-dashboard/work-dashboard";

export default async function Page() {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/");
  const organizationId = await getActiveOrganizationId(actor);
  const [work, dashboard] = await Promise.all([loadMyWork(actor, organizationId), loadWorkDashboard(actor, organizationId, "today")]);
  if (!work) redirect("/projects");
  if (work.onboardingState !== "complete") redirect("/onboarding");
  if (work.role === "client") redirect("/projects");
  if (!dashboard) redirect("/projects");

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6">
        <div>
          <p className="text-sm font-medium text-primary">My Work</p>
          <h1 className="text-2xl font-semibold tracking-tight">Your workday</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Time, progress, and assigned work in {work.timezone.replaceAll("_", " ")}.
          </p>
        </div>
        <WorkDashboard initial={dashboard} />
        <div><h2 className="text-xl font-semibold tracking-tight">Assigned to you</h2><p className="mt-1 text-sm text-muted-foreground">Unfinished tasks across your active projects.</p></div>
        <MyWork groups={work.groups} timezone={work.timezone} />
    </main>
  );
}
