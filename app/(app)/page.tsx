import { redirect } from "next/navigation";
import { MyWork } from "@/components/tasks/my-work";
import { loadMyWork } from "@/domain/tasks/my-work";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function Page() {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/");
  const organizationId = await getActiveOrganizationId(actor);
  const work = await loadMyWork(actor, organizationId);
  if (!work) redirect("/projects");
  if (work.onboardingState !== "complete") redirect("/onboarding");
  if (work.role === "client") redirect("/projects");

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6">
        <div>
          <p className="text-sm font-medium text-primary">My Work</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Assigned to you
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unfinished tasks across your active projects, organized in{" "}
            {work.timezone.replaceAll("_", " ")}.
          </p>
        </div>
        <MyWork groups={work.groups} timezone={work.timezone} />
    </main>
  );
}
