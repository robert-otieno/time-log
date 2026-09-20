"use server";

import { revalidatePath } from "next/cache";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { changeMemberRole, changeProjectAssignment, updateOrganizationSettings } from "@/domain/admin/service";
import { AuditedCommandError } from "@/domain/audit/command";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

function safeError(error: unknown) {
  if (error instanceof AuditedCommandError && error.reasonCode === "last_admin_required") return "The final active admin cannot lose admin access.";
  if (error instanceof AuditedCommandError && error.reasonCode === "client_project_mismatch") return "Clients can only access projects linked to their client company.";
  if (error instanceof AuditedCommandError && error.reasonCode === "project_archived") return "Archived projects cannot receive new assignments.";
  return "The change could not be saved.";
}

export async function updateOrganizationSettingsAction(raw: unknown) {
  const actor = await getSessionActor(); if (!actor) return { ok: false as const, error: "Your session expired." };
  try { await updateOrganizationSettings(actor, await getActiveOrganizationId(actor), raw, createRequestCorrelation()); revalidatePath("/admin"); return { ok: true as const }; }
  catch (error) { return { ok: false as const, error: safeError(error) }; }
}

export async function changeMemberRoleAction(raw: unknown) {
  const actor = await getSessionActor(); if (!actor) return { ok: false as const, error: "Your session expired." };
  try { await changeMemberRole(actor, await getActiveOrganizationId(actor), raw, createRequestCorrelation()); revalidatePath("/admin"); revalidatePath("/people"); return { ok: true as const }; }
  catch (error) { return { ok: false as const, error: safeError(error) }; }
}

export async function changeProjectAssignmentAction(raw: unknown) {
  const actor = await getSessionActor(); if (!actor) return { ok: false as const, error: "Your session expired." };
  try { await changeProjectAssignment(actor, await getActiveOrganizationId(actor), raw, createRequestCorrelation()); revalidatePath("/admin"); revalidatePath("/projects"); return { ok: true as const }; }
  catch (error) { return { ok: false as const, error: safeError(error) }; }
}
