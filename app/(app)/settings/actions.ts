"use server";

import { revalidatePath } from "next/cache";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { updateNotificationPreferences } from "@/domain/notifications/preferences";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export async function updateNotificationPreferencesAction(raw: unknown) {
  const actor = await getSessionActor(); if (!actor) return { ok: false as const, error: "Your session expired." };
  try { await updateNotificationPreferences(actor, await getActiveOrganizationId(actor), raw, createRequestCorrelation()); revalidatePath("/settings"); return { ok: true as const }; }
  catch { return { ok: false as const, error: "Your preferences could not be saved." }; }
}
