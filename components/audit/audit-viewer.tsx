import Link from "next/link";
import { AUDIT_ACTIONS } from "@/domain/audit/actions";
import { auditSummary, type AuditFilters } from "@/domain/audit/viewer";
import type { AuditEvent } from "@/domain/audit/schemas";
import { StatusBadge, statusTone } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AuditViewer({
  events,
  filters,
  nextCursor,
  basePath,
  timezone,
  projects = [],
  admin = false,
  scanLimited = false,
}: {
  events: AuditEvent[];
  filters: AuditFilters;
  nextCursor: string | null;
  basePath: string;
  timezone: string;
  projects?: Array<{ id: string; name: string }>;
  admin?: boolean;
  scanLimited?: boolean;
}) {
  const query = new URLSearchParams(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  query.delete("cursor");
  const next = new URLSearchParams(query);
  if (nextCursor) next.set("cursor", nextCursor);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>
          Append-only security and work history. Filters use safe metadata only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          action={basePath}
          className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-3 xl:grid-cols-6"
        >
          <Input
            name="startDate"
            type="date"
            defaultValue={filters.startDate}
            aria-label="Start date"
          />
          <Input
            name="endDate"
            type="date"
            defaultValue={filters.endDate}
            aria-label="End date"
          />
          <Input
            name="actorId"
            defaultValue={filters.actorId}
            placeholder="Actor ID"
            aria-label="Actor ID"
          />
          <select
            name="action"
            defaultValue={filters.action ?? ""}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
          <select
            name="outcome"
            defaultValue={filters.outcome ?? ""}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All outcomes</option>
            <option value="succeeded">Succeeded</option>
            <option value="denied">Denied</option>
            <option value="failed">Failed</option>
          </select>
          {admin && (
            <select
              name="projectId"
              defaultValue={filters.projectId ?? ""}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
          <select
            name="targetType"
            defaultValue={filters.targetType ?? ""}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All targets</option>
            {[
              "session",
              "organization",
              "membership",
              "invitation",
              "client",
              "project",
              "task",
              "migration",
              "timer",
              "time-entry",
              "file",
              "message",
              "comment",
              "notification",
              "approval",
              "connector",
              "agent-run",
            ].map((target) => (
              <option key={target}>{target}</option>
            ))}
          </select>
          <Button type="submit">Apply filters</Button>
          {admin && (
            <>
              <Button asChild variant="outline">
                <Link href={`${basePath}/export?${query}&format=csv`}>
                  Export CSV
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${basePath}/export?${query}&format=json`}>
                  Export JSON
                </Link>
              </Button>
            </>
          )}
        </form>
        {scanLimited && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
          >
            This filter required scanning more than 1,000 events. Refine the
            date range or filters for complete results.
          </p>
        )}
        {events.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            No audit events match these filters.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <article key={event.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{auditSummary(event)}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.actor.type} · {event.actor.id}
                      {event.projectId ? ` · project ${event.projectId}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      tone={statusTone(event.outcome)}
                      className="capitalize"
                    >
                      {event.outcome}
                    </StatusBadge>
                    <time className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("en-US", {
                        timeZone: timezone,
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(event.occurredAt.seconds * 1000))}
                    </time>
                  </div>
                </div>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    Correlation details
                  </summary>
                  <dl className="mt-2 grid gap-1 rounded-md bg-muted/30 p-3 font-mono text-xs">
                    <div>Request: {event.requestId}</div>
                    {event.runId && <div>Run: {event.runId}</div>}
                    <div>
                      Target: {event.target.type} / {event.target.id ?? "none"}
                    </div>
                    <div>Action: {event.action}</div>
                    <div>Schema: {event.schemaVersion}</div>
                    {event.reasonCode && <div>Reason: {event.reasonCode}</div>}
                    {event.changes.map((change, index) => (
                      <div key={`${change.field}-${index}`}>
                        {change.field}: {String(change.from ?? "—")} →{" "}
                        {String(change.to ?? "—")}
                      </div>
                    ))}
                  </dl>
                </details>
              </article>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          {nextCursor && (
            <Button asChild variant="outline">
              <Link href={`${basePath}?${next}`}>Next page</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
