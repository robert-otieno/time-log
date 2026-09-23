import { notFound, redirect } from "next/navigation";
import { TimerStartButton } from "@/components/time/timer-start-button";
import { ProjectTimeEntries } from "@/components/time/project-time-entries";
import { TimeReportView } from "@/components/time/time-report-view";
import { loadProjectTimeData } from "@/app/(app)/timer-actions";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAccessibleProject } from "@/domain/projects/service";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { OrganizationRepository } from "@/domain/organizations/repository";
import {
  loadProjectTimeReport,
  reportFiltersFromSearch,
} from "@/domain/time/reports";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ProjectTimePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/projects");
  const { projectId } = await params;
  const organizationId = await getActiveOrganizationId(actor);
  const access = await getAccessibleProject(actor, organizationId, projectId);
  if (!access || !access.project.enabledTools.includes("time")) notFound();
  const organization = await new OrganizationRepository().getOrganization(
    organizationId,
  );
  if (!organization) notFound();
  const filters = reportFiltersFromSearch(
    await searchParams,
    organization.timezone,
  );
  const report = await loadProjectTimeReport(
    actor,
    organizationId,
    projectId,
    filters,
    organization.timezone,
    access.role === "client" ? createRequestCorrelation() : undefined,
  );
  if (!report) notFound();
  const exportQuery = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    billable: filters.billable,
    reportingStatus: "approved",
  });
  if (filters.userId) exportQuery.set("userId", filters.userId);
  if (filters.taskId) exportQuery.set("taskId", filters.taskId);
  if (access.role === "client")
    return (
      <TimeReportView
        title="Shared time report"
        description="Only time approved for client reporting is included. Internal entries are never represented here."
        rows={report.rows}
        filters={{ ...filters, reportingStatus: "approved" }}
        timezone={organization.timezone}
        tasks={report.tasks}
        clientSafe
        truncated={report.truncated}
        exportHref={
          report.truncated
            ? undefined
            : `/projects/${projectId}/time/export?${exportQuery}`
        }
      />
    );
  const data = await loadProjectTimeData(projectId);
  if (!data) notFound();
  const safeFilters = { ...filters, reportingStatus: "approved" as const };
  const safeReport = await loadProjectTimeReport(
    actor,
    organizationId,
    projectId,
    safeFilters,
    organization.timezone,
    createRequestCorrelation(),
  );
  if (!safeReport) notFound();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Time tracking</CardTitle>
          <CardDescription>
            Start work against a saved task. The active timer remains visible
            while you move through Time Log.
          </CardDescription>
          <CardAction>
            <TimerStartButton
              projectId={projectId}
              label="Start project timer"
              variant="default"
            />
          </CardAction>
        </CardHeader>
      </Card>
      <ProjectTimeEntries
        projectId={projectId}
        role={data.role}
        tasks={data.tasks}
        entries={data.entries}
      />
      <TimeReportView
        title="Project report"
        description={
          access.role === "admin"
            ? "Review project time by team member, task, billing, and client-reporting status."
            : "Review your time recorded against this project."
        }
        rows={report.rows}
        filters={filters}
        timezone={organization.timezone}
        users={report.users}
        tasks={report.tasks}
        showUser={access.role === "admin"}
        truncated={report.truncated}
      />
      <TimeReportView
        title="Client-safe preview"
        description="This is the exact approved dataset available for CSV export. Internal entries and notes are excluded."
        rows={safeReport.rows}
        filters={safeFilters}
        timezone={organization.timezone}
        users={safeReport.users}
        tasks={safeReport.tasks}
        showUser={access.role === "admin"}
        clientSafe
        truncated={safeReport.truncated}
        exportHref={
          safeReport.truncated
            ? undefined
            : `/projects/${projectId}/time/export?${exportQuery}`
        }
      />
    </div>
  );
}
