"use server";

import { revalidatePath } from "next/cache";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { migrateLegacyTasks, type MigrationResult } from "@/domain/tasks/migration";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export type MigrationActionResult = { ok: true; data: MigrationResult } | { ok: false; error: string };

export async function migrateLegacyTasksAction(projectId: string): Promise<MigrationActionResult> {
  try {
    const actor = await getSessionActor();
    if (!actor) return { ok: false, error: "Sign in again before migrating tasks." };
    const organizationId = await getActiveOrganizationId(actor);
    const data = await migrateLegacyTasks(actor, organizationId, projectId, createRequestCorrelation());
    revalidatePath("/projects"); revalidatePath(`/projects/${projectId}/todos`); revalidatePath("/");
    return { ok: true, data };
  } catch (error) {
    const safe = error instanceof Error && ["Migration access denied", "Choose an active project with To-dos enabled", "Continue the migration in its original target project"].includes(error.message) ? error.message : "Legacy tasks could not be migrated. Try again.";
    return { ok: false, error: safe };
  }
}
