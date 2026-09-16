"use server";

import { revalidatePath } from "next/cache";

import { createRequestCorrelation } from "@/domain/audit/correlation";
import { ensurePersonalOrganization } from "@/domain/organizations/bootstrap";
import { saveOnboardingStep } from "@/domain/onboarding/service";
import { getSessionActor } from "@/lib/server-session";

export async function saveOnboardingAction(input: unknown) {
  const actor = await getSessionActor();
  if (!actor) return { ok: false as const, error: "Your session expired. Please sign in again." };
  try {
    await ensurePersonalOrganization(actor, createRequestCorrelation());
    const result = await saveOnboardingStep(actor, input, createRequestCorrelation());
    revalidatePath("/");
    revalidatePath("/onboarding");
    return { ok: true as const, currentStep: result.currentStep };
  } catch {
    return { ok: false as const, error: "We couldn’t save this step. Check your entries and try again." };
  }
}

