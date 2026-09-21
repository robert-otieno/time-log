import { AdminNav } from "@/components/admin/admin-nav";
import { redirect } from "next/navigation";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/admin");
  const membership = await new OrganizationRepository().getMembership(await getActiveOrganizationId(actor), actor.uid);
  if (membership?.status !== "active" || membership.role !== "admin") redirect("/");
  return <><AdminNav />{children}</>;
}
