"use server";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { createTaskComment, deleteTaskComment, updateTaskComment } from "@/domain/task-comments/service";
import { readTaskComments } from "@/domain/task-comments/read";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
async function context() { const actor = await getSessionActor(); if (!actor) throw new Error("Authentication required"); return { actor, organizationId: await getActiveOrganizationId(actor) }; }
async function run<T>(operation: (value: Awaited<ReturnType<typeof context>>) => Promise<T>): Promise<Result<T>> { try { return { ok: true, data: await operation(await context()) }; } catch { return { ok: false, error: "The task discussion could not be updated. Check your access and try again." }; } }

export async function loadTaskCommentsAction(projectId: string, taskId: string) { return run(({ actor, organizationId }) => readTaskComments(actor, organizationId, projectId, taskId)); }
export async function createTaskCommentAction(projectId: string, input: unknown) { return run(({ actor, organizationId }) => createTaskComment(actor, organizationId, projectId, input, createRequestCorrelation())); }
export async function updateTaskCommentAction(projectId: string, input: unknown) { return run(({ actor, organizationId }) => updateTaskComment(actor, organizationId, projectId, input, createRequestCorrelation())); }
export async function deleteTaskCommentAction(projectId: string, input: unknown) { return run(({ actor, organizationId }) => deleteTaskComment(actor, organizationId, projectId, input, createRequestCorrelation())); }
