import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, House, PanelsTopLeft, Settings, ShieldCheck, Users } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { ProjectSwitcher } from "@/components/projects/project-switcher";
import ThemeSwitch from "@/components/theme-switch";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { listAccessibleProjects } from "@/domain/projects/service";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const actor = await getSessionActor(); if (!actor) redirect("/login?next=/projects");
  const organizationId = await getActiveOrganizationId(actor);
  const [projects, membership] = await Promise.all([listAccessibleProjects(actor, organizationId), new OrganizationRepository().getMembership(organizationId, actor.uid)]);
  if (!projects || !membership) redirect("/");
  const isClient = membership.role === "client";
  return <div className="min-h-screen bg-muted/20"><header className="sticky top-0 z-40 border-b bg-background"><div className="mx-auto flex min-h-14 max-w-7xl items-center gap-3 px-4 py-2"><Link href="/projects" className="flex items-center gap-2 font-semibold"><FolderKanban className="size-5" />Time Log</Link><ProjectSwitcher projects={projects.map(({ id, name, key, status }) => ({ id, name, key, status }))} /><nav className="ml-auto flex flex-wrap items-center justify-end gap-1">{!isClient && <Link href="/" className="hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm"><House className="size-4" />My Work</Link>}<Link href="/projects" className="hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm"><PanelsTopLeft className="size-4" />Projects</Link>{!isClient && <Link href="/people" className="hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm"><Users className="size-4" />People</Link>}<Link href="/settings" className="hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm"><Settings className="size-4" />Settings</Link>{membership.role === "admin" && <Link href="/admin" className="hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm"><ShieldCheck className="size-4" />Admin</Link>}<ThemeSwitch /><LogoutButton /></nav></div></header>{children}</div>;
}
