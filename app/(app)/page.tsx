import TaskDashboard from "@/components/task-dashboard";
import { redirect } from "next/navigation";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { personalOrganizationId } from "@/domain/organizations/bootstrap";
import { getSessionActor } from "@/lib/server-session";

export default async function Page() {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/");
  const organization = await new OrganizationRepository().getOrganization(personalOrganizationId(actor.uid));
  if (organization?.onboardingState !== "complete") redirect("/onboarding");
  return <TaskDashboard />;
}
