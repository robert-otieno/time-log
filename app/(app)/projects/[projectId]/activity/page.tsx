import { notFound, redirect } from "next/navigation";
import { AuditViewer } from "@/components/audit/audit-viewer";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { auditFiltersFromSearch, listAuditEvents } from "@/domain/audit/viewer";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ProjectActivityPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) { const actor = await getSessionActor(); if (!actor) redirect("/login?next=/projects"); const { projectId } = await params; const organizationId = await getActiveOrganizationId(actor); const organization = await new OrganizationRepository().getOrganization(organizationId); if (!organization) notFound(); const filters = auditFiltersFromSearch(await searchParams, projectId); const result = await listAuditEvents(actor, organizationId, filters, organization.timezone); if (!result) notFound(); return <AuditViewer {...result} filters={filters} basePath={`/projects/${projectId}/activity`} timezone={organization.timezone} />; }
