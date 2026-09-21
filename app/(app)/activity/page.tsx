import { redirect } from "next/navigation";
import { AuditViewer } from "@/components/audit/audit-viewer";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { listAccessibleProjects } from "@/domain/projects/service";
import { AdminNav } from "@/components/admin/admin-nav";
import { auditFiltersFromSearch, listAuditEvents } from "@/domain/audit/viewer";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { const actor = await getSessionActor(); if (!actor) redirect("/login?next=/activity"); const organizationId = await getActiveOrganizationId(actor); const repository = new OrganizationRepository(); const organization = await repository.getOrganization(organizationId); if (!organization) redirect("/"); const filters = auditFiltersFromSearch(await searchParams); const result = await listAuditEvents(actor, organizationId, filters, organization.timezone); if (!result || result.role !== "admin") redirect("/"); const projects = await listAccessibleProjects(actor, organizationId); return <><AdminNav /><main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"><header><p className="text-sm font-medium text-primary">Administration</p><h1 className="text-3xl font-semibold tracking-tight">Organization activity</h1><p className="text-muted-foreground">Search the append-only history for {organization.name}.</p></header><AuditViewer {...result} filters={filters} basePath="/activity" timezone={organization.timezone} projects={(projects ?? []).map(({ id, name }) => ({ id, name }))} admin /></main></>; }
