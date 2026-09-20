"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { selectProjectAction } from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectSwitcher({
  projects,
}: {
  projects: { id: string; name: string; key: string; status: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const currentId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const current = projects.find((project) => project.id === currentId);

  const openProject = (project: (typeof projects)[number]) => {
    setPendingProjectId(project.id);
    router.push(`/projects/${project.id}`);
    if (project.status === "archived") return;
    startTransition(async () => {
      const result = await selectProjectAction(project.id);
      if (!result.ok)
        toast.error(
          "The project opened, but your default project could not be saved.",
        );
      setPendingProjectId(null);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="max-w-64 justify-between"
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          <span className="truncate">
            {current ? `${current.name}` : "Select project"}
            {/* {current ? `${current.key} · ${current.name}` : "Select project"} */}
          </span>
          <ChevronsUpDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            disabled={pending}
            onSelect={() => openProject(project)}
          >
            {pendingProjectId === project.id ? (
              <Loader2 className="animate-spin" />
            ) : null}
            {project.name}
            {/* {project.key} · {project.name} */}
            {project.status === "archived" ? " (Archived)" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
