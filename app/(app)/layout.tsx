import { redirect } from "next/navigation";

import { loadTimerStateAction } from "@/app/(app)/timer-actions";
import { GlobalTimerControl } from "@/components/time/global-timer-control";
import { AppHeader } from "@/components/layout/app-header";
import { hasCapability } from "@/domain/organizations/policy";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { listAccessibleProjects } from "@/domain/projects/service";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/");
  const organizationId = await getActiveOrganizationId(actor);
  const [timerState, membership, projects] = await Promise.all([
    loadTimerStateAction(),
    new OrganizationRepository().getMembership(organizationId, actor.uid),
    listAccessibleProjects(actor, organizationId),
  ]);
  if (!membership || !projects) redirect("/");
  const canTrack = hasCapability(membership, "time.track");
  const initialTimer = timerState.ok ? timerState.timer : null;

  return <><GlobalTimerControl initialTimer={initialTimer} canTrack={canTrack} /><div className="min-h-screen bg-muted/20"><AppHeader projects={projects.map(({ id, name, key, status }) => ({ id, name, key, status }))} role={membership.role} /><div className={canTrack || initialTimer ? "pb-28" : undefined}>{children}</div></div></>;
}
