import { redirect } from "next/navigation";
import { TimeReportView } from "@/components/time/time-report-view";
import { Button } from "@/components/ui/button";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { defaultWeekDates } from "@/domain/time/reporting";
import { loadPersonalTimeReport, reportFiltersFromSearch } from "@/domain/time/reports";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function PersonalTimePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getSessionActor(); if (!actor) redirect("/login?next=/time");
  const organizationId = await getActiveOrganizationId(actor); const repository = new OrganizationRepository(); const [organization, membership] = await Promise.all([repository.getOrganization(organizationId), repository.getMembership(organizationId, actor.uid)]); if (!organization) redirect("/"); if (!membership || membership.role === "client") redirect("/projects");
  const search = await searchParams; const view = search.view === "day" ? "day" : "week";
  const week = defaultWeekDates(new Date(), organization.timezone);
  const normalized = view === "day" && !search.startDate && !search.endDate ? { ...search, startDate: new Intl.DateTimeFormat("en-CA", { timeZone: organization.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), endDate: new Intl.DateTimeFormat("en-CA", { timeZone: organization.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) } : view === "week" && !search.startDate ? { ...search, ...week } : search;
  const filters = reportFiltersFromSearch(normalized, organization.timezone); const report = await loadPersonalTimeReport(actor, organizationId, filters, organization.timezone);
  const days = view === "day" ? 1 : 7; const shift = (amount: number) => { const start = new Date(`${filters.startDate}T00:00:00Z`); const end = new Date(`${filters.endDate}T00:00:00Z`); start.setUTCDate(start.getUTCDate() + amount * days); end.setUTCDate(end.getUTCDate() + amount * days); return `/time?view=${view}&startDate=${start.toISOString().slice(0, 10)}&endDate=${end.toISOString().slice(0, 10)}`; };
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"><header><p className="text-sm font-medium text-primary">My Time</p><h1 className="text-2xl font-semibold tracking-tight">Personal time</h1><p className="mt-1 text-sm text-muted-foreground">Your recorded time across accessible projects.</p></header><div className="flex flex-wrap gap-2"><Button asChild variant={view === "day" ? "default" : "outline"}><a href="/time?view=day">Today</a></Button><Button asChild variant={view === "week" ? "default" : "outline"}><a href="/time?view=week">This week</a></Button><Button asChild variant="outline"><a href={shift(-1)}>Previous</a></Button><Button asChild variant="outline"><a href={shift(1)}>Next</a></Button></div><TimeReportView title={view === "day" ? "Daily view" : "Weekly view"} description="Only your own time entries are included." rows={report.rows} filters={filters} timezone={organization.timezone} tasks={report.tasks} showProject truncated={report.truncated} /></main>;
}
