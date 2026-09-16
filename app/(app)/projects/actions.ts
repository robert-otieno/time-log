"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { changeProjectStatus, createProject, selectActiveProject, updateProject } from "@/domain/projects/service";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export type ProjectActionState = { error: string | null; message?: string | null };

function fields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "").trim() || null,
    clientId: String(formData.get("clientId") ?? "").trim() || null,
    enabledTools: formData.getAll("enabledTools").map(String),
  };
}

export async function createProjectAction(_state: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const actor = await getSessionActor(); if (!actor) return { error: "Your session expired." };
  let destination: string;
  try {
    const organizationId = await getActiveOrganizationId(actor);
    const project = await createProject(actor, organizationId, fields(formData), createRequestCorrelation());
    await selectActiveProject(actor, organizationId, { projectId: project.id });
    destination = `/projects/${project.id}`;
  } catch { return { error: "We couldn’t create the project. Check the details and try again." }; }
  revalidatePath("/projects");
  redirect(destination);
}

export async function updateProjectAction(_state: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const actor = await getSessionActor(); if (!actor) return { error: "Your session expired." };
  const projectId = String(formData.get("projectId") ?? "");
  try { await updateProject(actor, await getActiveOrganizationId(actor), { projectId, ...fields(formData) }, createRequestCorrelation()); revalidatePath(`/projects/${projectId}`); return { error: null, message: "Project updated." }; }
  catch { return { error: "We couldn’t update this project." }; }
}

export async function changeProjectStatusAction(projectId: string, status: "active" | "on_hold" | "completed" | "archived") {
  const actor = await getSessionActor(); if (!actor) return { ok: false as const, error: "Your session expired." };
  try { await changeProjectStatus(actor, await getActiveOrganizationId(actor), { projectId, status }, createRequestCorrelation()); revalidatePath("/projects"); revalidatePath(`/projects/${projectId}`); return { ok: true as const }; }
  catch { return { ok: false as const, error: "We couldn’t change the project status." }; }
}

export async function selectProjectAction(projectId: string) {
  const actor = await getSessionActor(); if (!actor) return { ok: false as const };
  try { await selectActiveProject(actor, await getActiveOrganizationId(actor), { projectId }); return { ok: true as const }; }
  catch { return { ok: false as const }; }
}
