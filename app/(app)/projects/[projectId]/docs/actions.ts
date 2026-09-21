"use server";

import { revalidatePath } from "next/cache";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { archiveFile, changeFileVisibility, createFileUploadIntent, finalizeFileUpload } from "@/domain/files/service";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export type FileActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };
async function run<T>(projectId: string, operation: (actor: NonNullable<Awaited<ReturnType<typeof getSessionActor>>>, organizationId: string) => Promise<T>): Promise<FileActionResult<T>> {
  try {
    const actor = await getSessionActor(); if (!actor) return { ok: false, error: "Your session has expired. Sign in again." };
    const data = await operation(actor, await getActiveOrganizationId(actor)); revalidatePath(`/projects/${projectId}/docs`); return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error && ["Clients cannot upload files", "File uploads are unavailable", "Uploaded file validation failed", "A clean malware scan is required before client sharing", "File archive denied"].includes(error.message) ? error.message : "The file action could not be completed. Try again.";
    return { ok: false, error: message };
  }
}

export async function createFileUploadIntentAction(projectId: string, input: unknown) { return run(projectId, (actor, org) => createFileUploadIntent(actor, org, { ...(input as object), projectId }, createRequestCorrelation())); }
export async function finalizeFileUploadAction(projectId: string, fileId: string) { return run(projectId, (actor, org) => finalizeFileUpload(actor, org, projectId, fileId, createRequestCorrelation())); }
export async function changeFileVisibilityAction(projectId: string, fileId: string, visibility: string) { return run(projectId, (actor, org) => changeFileVisibility(actor, org, projectId, fileId, visibility, createRequestCorrelation())); }
export async function archiveFileAction(projectId: string, fileId: string) { return run(projectId, (actor, org) => archiveFile(actor, org, projectId, fileId, createRequestCorrelation())); }
