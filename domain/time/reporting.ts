import { z } from "zod";
import type { TimeEntry } from "@/domain/time/schemas";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const timeReportFiltersSchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  userId: z.string().trim().min(1).max(128).optional(),
  taskId: z.string().trim().min(1).max(128).optional(),
  billable: z.enum(["all", "yes", "no"]).default("all"),
  reportingStatus: z.enum(["all", "internal", "approved"]).default("all"),
}).strict().superRefine((value, context) => {
  if (value.endDate < value.startDate) context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date" });
  const span = Math.round((Date.parse(`${value.endDate}T00:00:00Z`) - Date.parse(`${value.startDate}T00:00:00Z`)) / 86_400_000);
  if (span > 366) context.addIssue({ code: "custom", path: ["endDate"], message: "Reports are limited to 367 days" });
});

export type TimeReportFilters = z.infer<typeof timeReportFiltersSchema>;
export type TimeReportRow = {
  id: string;
  projectId: string;
  projectName: string;
  taskId: string | null;
  taskTitle: string;
  userId: string;
  userName: string;
  startedAt: string;
  durationSeconds: number;
  billable: boolean;
  reportingStatus: "internal" | "approved";
};

function timezoneOffsetMs(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), Number(value.hour), Number(value.minute), Number(value.second)) - date.getTime();
}

export function zonedDateBoundary(date: string, timezone: string, endExclusive = false) {
  const [year, month, day] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day + (endExclusive ? 1 : 0)));
  let instant = new Date(guess.getTime() - timezoneOffsetMs(guess, timezone));
  instant = new Date(guess.getTime() - timezoneOffsetMs(instant, timezone));
  return instant;
}

export function defaultWeekDates(now: Date, timezone: string) {
  const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
  const local = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const mondayOffset = (local.getUTCDay() + 6) % 7;
  const start = new Date(local); start.setUTCDate(start.getUTCDate() - mondayOffset);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export function filterTimeEntries(entries: TimeEntry[], filters: TimeReportFilters, forcedUserId?: string, clientSafe = false) {
  return entries.filter((entry) => {
    if (forcedUserId && entry.userId !== forcedUserId) return false;
    if (!forcedUserId && filters.userId && entry.userId !== filters.userId) return false;
    if (filters.taskId && entry.taskId !== filters.taskId) return false;
    if (filters.billable !== "all" && entry.billable !== (filters.billable === "yes")) return false;
    if (clientSafe && entry.clientReportingStatus !== "approved") return false;
    return clientSafe || filters.reportingStatus === "all" || entry.clientReportingStatus === filters.reportingStatus;
  });
}

export function summarizeTimeRows(rows: TimeReportRow[]) {
  return rows.reduce((summary, row) => ({
    seconds: summary.seconds + row.durationSeconds,
    billableSeconds: summary.billableSeconds + (row.billable ? row.durationSeconds : 0),
    entries: summary.entries + 1,
  }), { seconds: 0, billableSeconds: 0, entries: 0 });
}

function csvCell(value: string | number | boolean) {
  const raw = String(value);
  const text = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function clientSafeReportCsv(rows: TimeReportRow[], timezone: string) {
  const header = ["Date", "Team member", "Task", "Duration (hours)", "Billable"];
  const body = rows.map((row) => [
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.startedAt)),
    row.userName,
    row.taskTitle,
    (row.durationSeconds / 3600).toFixed(2),
    row.billable ? "Yes" : "No",
  ]);
  return [header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
}
