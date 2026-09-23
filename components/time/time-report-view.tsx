import Link from "next/link";
import { Download } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TimeReportFilters } from "@/components/time/time-report-filters";
import {
  summarizeTimeRows,
  type TimeReportFilters as Filters,
  type TimeReportRow,
} from "@/domain/time/reporting";

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function TimeReportView({
  title,
  description,
  rows,
  filters,
  timezone,
  users = [],
  tasks = [],
  showUser = false,
  showTask = true,
  showProject = false,
  clientSafe = false,
  truncated = false,
  exportHref,
}: {
  title: string;
  description: string;
  rows: TimeReportRow[];
  filters: Filters;
  timezone: string;
  users?: Array<{ id: string; name: string }>;
  tasks?: Array<{ id: string; title: string }>;
  showUser?: boolean;
  showTask?: boolean;
  showProject?: boolean;
  clientSafe?: boolean;
  truncated?: boolean;
  exportHref?: string;
}) {
  const summary = summarizeTimeRows(rows);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          {exportHref && (
            <Button asChild variant="outline">
              <Link href={exportHref}>
                <Download />
                Export CSV
              </Link>
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        <TimeReportFilters
          filters={filters}
          users={users}
          tasks={tasks}
          showUser={showUser}
          showTask={showTask}
          clientSafe={clientSafe}
        />
        {truncated && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
          >
            This range contains more than 2,000 entries. The totals and rows
            below are partial; narrow the date range before relying on or
            exporting this report.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total time</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {duration(summary.seconds)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Billable</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {duration(summary.billableSeconds)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Entries</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {summary.entries}
            </p>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-lg border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No time entries match this report.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-3 font-medium">Date</th>
                  {showProject && <th className="p-3 font-medium">Project</th>}
                  <th className="p-3 font-medium">Task</th>
                  <th className="p-3 font-medium">Team member</th>
                  <th className="p-3 text-right font-medium">Duration</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.projectId}-${row.id}`} className="border-t">
                    <td className="p-3 text-muted-foreground">
                      {formatter.format(new Date(row.startedAt))}
                    </td>
                    {showProject && <td className="p-3">{row.projectName}</td>}
                    <td className="p-3 font-medium">{row.taskTitle}</td>
                    <td className="p-3">{row.userName}</td>
                    <td className="p-3 text-right font-mono tabular-nums">
                      {duration(row.durationSeconds)}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {row.billable && (
                          <StatusBadge tone="info">Billable</StatusBadge>
                        )}
                        {!clientSafe && (
                          <StatusBadge
                            tone={
                              row.reportingStatus === "approved"
                                ? "success"
                                : "neutral"
                            }
                          >
                            {row.reportingStatus === "approved"
                              ? "Approved"
                              : "Internal"}
                          </StatusBadge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Dates and totals use {timezone.replaceAll("_", " ")}. Weeks run Monday
          through Sunday.
        </p>
      </CardContent>
    </Card>
  );
}
