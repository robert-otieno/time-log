import { redirect } from "next/navigation";

import { createRequestCorrelation } from "@/domain/audit/correlation";
import { ensurePersonalOrganization } from "@/domain/organizations/bootstrap";
import { getSessionActor } from "@/lib/server-session";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/");
  await ensurePersonalOrganization(actor, createRequestCorrelation());

  return children;
}
