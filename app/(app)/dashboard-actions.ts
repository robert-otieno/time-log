"use server";

import { createRequestCorrelation } from "@/domain/audit/correlation";
import { dashboardPeriodSchema, loadWorkDashboard, updateWorkTarget, updateWorkTargetSchema } from "@/domain/work-dashboard/service";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export async function loadWorkDashboardAction(period: unknown) {
  const actor = await getSessionActor();
  if (!actor) return { ok: false as const, code: "session_expired" as const };
  try {
    const organizationId = await getActiveOrganizationId(actor);
    const dashboard = await loadWorkDashboard(actor, organizationId, dashboardPeriodSchema.parse(period));
    return dashboard ? { ok: true as const, dashboard } : { ok: false as const, code: "dashboard_denied" as const };
  } catch {
    return { ok: false as const, code: "dashboard_unavailable" as const };
  }
}

export async function updateWorkTargetAction(raw: unknown) {
  const actor = await getSessionActor();
  if (!actor) return { ok: false as const, code: "session_expired" as const };
  try {
    const organizationId = await getActiveOrganizationId(actor);
    await updateWorkTarget(actor, organizationId, updateWorkTargetSchema.parse(raw), createRequestCorrelation());
    return { ok: true as const };
  } catch {
    return { ok: false as const, code: "target_update_failed" as const };
  }
}
