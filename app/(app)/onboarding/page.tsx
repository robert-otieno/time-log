import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { personalOrganizationId } from "@/domain/organizations/bootstrap";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { getOnboardingState } from "@/domain/onboarding/service";
import { getSessionActor } from "@/lib/server-session";

export default async function OnboardingPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/onboarding");
  const organization = await new OrganizationRepository().getOrganization(personalOrganizationId(actor.uid));
  if (!organization) throw new Error("Personal organization is unavailable.");
  if (organization.onboardingState === "complete") redirect("/");
  const state = await getOnboardingState(actor);

  return <OnboardingFlow initial={{
    step: state?.currentStep ?? "profile",
    displayName: state?.profile?.displayName ?? actor.displayName ?? "",
    timezone: state?.profile?.timezone ?? "",
    workingHours: state?.profile?.workingHours ?? { days: ["mon", "tue", "wed", "thu", "fri"], start: "09:00", end: "17:00" },
    emailPreferences: state?.profile?.emailPreferences ?? { assignments: true, mentions: true, reminders: true, digest: true },
    organizationName: organization.name,
    projectName: "My first project",
  }} />;
}

