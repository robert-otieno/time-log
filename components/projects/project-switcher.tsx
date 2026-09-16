"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { selectProjectAction } from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ProjectSwitcher({ projects }: { projects: { id: string; name: string; key: string; status: string }[] }) {
  const pathname = usePathname(); const router = useRouter();
  const currentId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const current = projects.find((project) => project.id === currentId);
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="max-w-64 justify-between"><span className="truncate">{current ? `${current.key} · ${current.name}` : "Select project"}</span><ChevronsUpDown /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-64"><DropdownMenuLabel>Projects</DropdownMenuLabel>{projects.map((project) => <DropdownMenuItem key={project.id} onSelect={async () => { if (project.status === "archived") { router.push(`/projects/${project.id}`); return; } const result = await selectProjectAction(project.id); if (result.ok) router.push(`/projects/${project.id}`); }}>{project.key} · {project.name}{project.status === "archived" ? " (Archived)" : ""}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}
