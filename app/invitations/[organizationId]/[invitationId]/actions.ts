"use server";

import { redirect } from "next/navigation";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { acceptInvitation } from "@/domain/invitations/service";
import { getSessionActor } from "@/lib/server-session";

export async function acceptInvitationAction(organizationId: string, invitationId: string, token: string) {
  const actor = await getSessionActor();
  if (!actor) redirect(`/login?next=${encodeURIComponent(`/invitations/${organizationId}/${invitationId}?token=${token}`)}`);
  try {
    await acceptInvitation(actor, { organizationId, invitationId, token }, createRequestCorrelation());
  } catch {
    redirect(`/invitations/${organizationId}/${invitationId}?token=${encodeURIComponent(token)}&error=invalid`);
  }
  redirect("/");
}
