import { NextResponse } from "next/server";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { clientSafeReportCsv } from "@/domain/time/reporting";
import { auditTimeReportExport, loadProjectTimeReport, reportFiltersFromSearch } from "@/domain/time/reports";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const actor = await getSessionActor(); if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await params; const organizationId = await getActiveOrganizationId(actor); const organization = await new OrganizationRepository().getOrganization(organizationId); if (!organization) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const search = Object.fromEntries(new URL(request.url).searchParams); const filters = { ...reportFiltersFromSearch(search, organization.timezone), reportingStatus: "approved" as const };
  const report = await loadProjectTimeReport(actor, organizationId, projectId, filters, organization.timezone); if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (report.truncated) return NextResponse.json({ error: "Narrow the report date range before exporting." }, { status: 422, headers: { "Cache-Control": "private, no-store" } });
  const approvedRows = report.rows.filter((row) => row.reportingStatus === "approved"); const csv = clientSafeReportCsv(approvedRows, organization.timezone);
  await auditTimeReportExport(actor, report.role, organizationId, projectId, createRequestCorrelation());
  return new NextResponse(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${projectId}-time-report-${filters.startDate}-${filters.endDate}.csv"`, "Cache-Control": "private, no-store" } });
}
