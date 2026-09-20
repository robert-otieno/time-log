import { redirect } from "next/navigation";

import { loadTimerStateAction } from "@/app/(app)/timer-actions";
import { GlobalTimerControl } from "@/components/time/global-timer-control";
import { hasCapability } from "@/domain/organizations/policy";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/");
  const organizationId = await getActiveOrganizationId(actor);
  const [timerState, membership] = await Promise.all([
    loadTimerStateAction(),
    new OrganizationRepository().getMembership(organizationId, actor.uid),
  ]);
  const canTrack = hasCapability(membership, "time.track");
  const initialTimer = timerState.ok ? timerState.timer : null;

  return <><GlobalTimerControl initialTimer={initialTimer} canTrack={canTrack} /><div className={canTrack || initialTimer ? "pb-28" : undefined}>{children}</div></>;
}
