import type { Client, Project } from "@/domain/organizations/schemas";
import type { ProjectTool } from "@/domain/projects/schemas";

export type ProjectFormClient = { id: string; name: string };
export type ProjectFormProject = {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  enabledTools: ProjectTool[];
};

export function toProjectFormClient(client: Client): ProjectFormClient {
  return { id: client.id, name: client.name };
}

export function toProjectFormProject(project: Project): ProjectFormProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    clientId: project.clientId,
    enabledTools: [...project.enabledTools],
  };
}
