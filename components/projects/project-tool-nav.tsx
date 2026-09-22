import Link from "next/link";
import type { ProjectTool } from "@/domain/projects/schemas";
import { AVAILABLE_PROJECT_TOOLS } from "@/domain/projects/tools";

export function ProjectToolNav({ projectId, availableTools, showActivity = false }: { projectId: string; availableTools: ProjectTool[]; showActivity?: boolean }) {
  return <nav aria-label="Project tools" className="flex flex-wrap gap-2 border-b pb-3"><Link className="hover:bg-accent rounded-md px-3 py-2 text-sm font-medium" href={`/projects/${projectId}`}>Overview</Link>{AVAILABLE_PROJECT_TOOLS.filter((tool) => availableTools.includes(tool.id)).map((tool) => <Link key={tool.id} className="hover:bg-accent rounded-md px-3 py-2 text-sm font-medium" href={`/projects/${projectId}/${tool.path}`}>{tool.label}</Link>)}{showActivity && <Link className="hover:bg-accent rounded-md px-3 py-2 text-sm font-medium" href={`/projects/${projectId}/activity`}>Activity</Link>}</nav>;
}
