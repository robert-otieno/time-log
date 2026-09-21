"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { changeMembershipAccess, createInvitation } from "@/domain/invitations/service";
import { deliverNotification } from "@/domain/notifications/outbox";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export async function invitePersonAction(formData: FormData) {
  const actor = await getSessionActor(); if (!actor) redirect("/login?next=/admin/people");
  const organizationId = await getActiveOrganizationId(actor); const role = String(formData.get("role")); const existingClientId = String(formData.get("clientId") ?? ""); const newClientName = String(formData.get("newClientName") ?? "").trim();
  const client = role !== "client" ? { mode: "none" as const } : newClientName ? { mode: "create" as const, name: newClientName } : { mode: "existing" as const, clientId: existingClientId };
  let outcome = "failed";
  try { const result = await createInvitation(actor, organizationId, { email: String(formData.get("email") ?? ""), role, client, projectIds: formData.getAll("projectIds").map(String) }, createRequestCorrelation()); outcome = "queued"; try { const delivery = await deliverNotification(organizationId, result.notificationId); outcome = delivery.ok ? "sent" : "queued"; } catch { /* Durable retry owns provider failures. */ } } catch { /* Return a safe generic result. */ }
  revalidatePath("/admin/people"); redirect(`/admin/people?invite=${outcome}`);
}

export async function changeMembershipAccessAction(userId: string, action: "suspend" | "restore" | "remove") {
  const actor = await getSessionActor(); if (!actor) return { ok: false as const, error: "Your session expired." };
  try { await changeMembershipAccess(actor, await getActiveOrganizationId(actor), { userId, action }, createRequestCorrelation()); revalidatePath("/admin"); revalidatePath("/admin/people"); return { ok: true as const }; }
  catch { return { ok: false as const, error: "We couldn’t update this person’s access." }; }
}
