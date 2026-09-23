"use server";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { archiveTask, changeTaskStatus, createTask, restoreTask, updateTask } from "@/domain/tasks/service";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export type TaskActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };
const safeError = (error: unknown) => error instanceof Error && ["Task management denied", "Project tasks are unavailable", "Archived tasks are read-only", "Parent task not found", "An assignee is not eligible for this project"].includes(error.message) ? error.message : "The task could not be saved. Try again.";
async function context(projectId: string) { const actor = await getSessionActor(); if (!actor) throw new Error("Authentication required"); return { actor, organizationId: await getActiveOrganizationId(actor), projectId }; }
async function run<T>(projectId: string, operation: (value: Awaited<ReturnType<typeof context>>) => Promise<T>): Promise<TaskActionResult<T>> { try { const data = await operation(await context(projectId)); return { ok: true, data }; } catch (error) { return { ok: false, error: safeError(error) }; } }

export async function createTaskAction(projectId: string, input: unknown) { return run(projectId, ({ actor, organizationId }) => createTask(actor, organizationId, projectId, input, createRequestCorrelation())); }
export async function updateTaskAction(projectId: string, input: unknown) { return run(projectId, ({ actor, organizationId }) => updateTask(actor, organizationId, projectId, input, createRequestCorrelation())); }
export async function changeTaskStatusAction(projectId: string, taskId: string, status: string) { return run(projectId, ({ actor, organizationId }) => changeTaskStatus(actor, organizationId, projectId, { taskId, status }, createRequestCorrelation())); }
export async function archiveTaskAction(projectId: string, taskId: string) { return run(projectId, ({ actor, organizationId }) => archiveTask(actor, organizationId, projectId, { taskId }, createRequestCorrelation())); }
export async function restoreTaskAction(projectId: string, taskId: string) { return run(projectId, ({ actor, organizationId }) => restoreTask(actor, organizationId, projectId, { taskId }, createRequestCorrelation())); }
