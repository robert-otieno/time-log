import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Users } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { ProjectSwitcher } from "@/components/projects/project-switcher";
import ThemeSwitch from "@/components/theme-switch";
import { listAccessibleProjects } from "@/domain/projects/service";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const actor = await getSessionActor(); if (!actor) redirect("/login?next=/projects");
  const projects = await listAccessibleProjects(actor, await getActiveOrganizationId(actor));
  if (!projects) redirect("/");
  return <div className="min-h-screen bg-muted/20"><header className="sticky top-0 z-40 border-b bg-background"><div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4"><Link href="/projects" className="flex items-center gap-2 font-semibold"><FolderKanban className="size-5" />Time Log</Link><ProjectSwitcher projects={projects.map(({ id, name, key, status }) => ({ id, name, key, status }))} /><nav className="ml-auto flex items-center gap-1"><Link href="/projects" className="hover:bg-accent rounded-md px-3 py-2 text-sm">Projects</Link><Link href="/people" className="hover:bg-accent rounded-md p-2" aria-label="People"><Users className="size-4" /></Link><ThemeSwitch /><LogoutButton /></nav></div></header>{children}</div>;
}
