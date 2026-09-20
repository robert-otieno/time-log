import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefcaseBusiness, FolderKanban, Settings, UserRoundCog, Users } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { MyWork } from "@/components/tasks/my-work";
import ThemeSwitch from "@/components/theme-switch";
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
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <BriefcaseBusiness className="size-5" />
            Time Log
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            <Link
              href="/projects"
              className="hover:bg-accent rounded-md px-3 py-2 text-sm"
            >
              <span className="hidden sm:inline">Projects</span>
              <FolderKanban className="size-4 sm:hidden" />
            </Link>
            <Link
              href="/people"
              className="hover:bg-accent rounded-md p-2"
              aria-label="People"
            >
              <Users className="size-4" />
            </Link>
            <Link href="/settings" className="hover:bg-accent rounded-md p-2" aria-label="Personal settings"><UserRoundCog className="size-4" /></Link>
            {work.role === "admin" && (
              <Link
                href="/admin"
                className="hover:bg-accent rounded-md p-2"
                aria-label="Administration"
              >
                <Settings className="size-4" />
              </Link>
            )}
            <ThemeSwitch />
            <LogoutButton />
          </nav>
        </div>
      </header>
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
    </div>
  );
}
