"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, House, Menu, PanelsTopLeft, Settings, ShieldCheck, Users } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { ProjectSwitcher } from "@/components/projects/project-switcher";
import ThemeSwitch from "@/components/theme-switch";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type HeaderProject = { id: string; name: string; key: string; status: "active" | "on_hold" | "completed" | "archived" };

export function AppHeader({ projects, role }: { projects: HeaderProject[]; role: "admin" | "member" | "client" }) {
  const pathname = usePathname();
  const isClient = role === "client";
  if (pathname === "/onboarding") return null;
  const items = [{ href: "/", label: "My Work", icon: House, visible: !isClient, active: pathname === "/" }, { href: "/projects", label: "Projects", icon: PanelsTopLeft, visible: true, active: pathname.startsWith("/projects") }, { href: "/people", label: "People", icon: Users, visible: !isClient, active: pathname.startsWith("/people") }, { href: "/settings", label: "Settings", icon: Settings, visible: true, active: pathname.startsWith("/settings") }, { href: "/admin", label: "Admin", icon: ShieldCheck, visible: role === "admin", active: pathname.startsWith("/admin") }].filter((item) => item.visible);
  return <header className="sticky top-0 z-40 border-b bg-background"><div className="mx-auto flex min-h-14 max-w-7xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4"><Link href={isClient ? "/projects" : "/"} className="flex shrink-0 items-center gap-2 font-semibold"><FolderKanban className="size-5" /><span className="hidden sm:inline">Time Log</span></Link><ProjectSwitcher projects={projects} /><nav className="ml-auto hidden items-center gap-1 xl:flex">{items.map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm", active && "bg-accent text-accent-foreground font-medium")}><Icon className="size-4" />{label}</Link>)}</nav><div className="ml-auto flex shrink-0 items-center gap-1 xl:ml-0"><ThemeSwitch /><LogoutButton /><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="xl:hidden" aria-label="Open navigation menu"><Menu className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuLabel>Navigate</DropdownMenuLabel>{items.map(({ href, label, icon: Icon, active }) => <DropdownMenuItem key={href} asChild className={cn(active && "bg-accent font-medium")}><Link href={href} aria-current={active ? "page" : undefined}><Icon className="size-4" />{label}</Link></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div></div></header>;
}
