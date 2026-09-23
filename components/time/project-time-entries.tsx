"use client";

import { useState } from "react";
import { Clock3, Loader2, Pencil, Plus } from "lucide-react";
import {
  correctTimeEntryAction,
  createManualTimeEntryAction,
  type TimeEntryView,
} from "@/app/(app)/timer-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOptimisticMutations } from "@/hooks/use-optimistic-mutations";

type PickerValue = { date: string; time: string; includeTime: boolean };
const PROJECT_LEVEL = "__project_level__";
function picker(date: Date): PickerValue {
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  ).toISOString();
  return {
    date: local.slice(0, 10),
    time: local.slice(11, 16),
    includeTime: true,
  };
}
function instant(value: PickerValue) {
  return value.date && value.includeTime
    ? new Date(`${value.date}T${value.time}:00`).toISOString()
    : null;
}
function samePickerValue(left: PickerValue, right: PickerValue) {
  return (
    left.date === right.date &&
    left.time === right.time &&
    left.includeTime === right.includeTime
  );
}
function correctionError(code: string) {
  switch (code) {
    case "time_range_invalid":
      return "End time must be after start time.";
    case "time_end_in_future":
      return "End time cannot be in the future.";
    case "time_duration_unreasonable":
      return "The time entry is too long to save.";
    case "timer_task_required":
      return "Select a saved task.";
    case "timer_task_not_found":
    case "timer_task_unavailable":
      return "The selected task is no longer available.";
    case "time_entry_not_found":
      return "This time entry no longer exists.";
    case "time_entry_denied":
    case "time_entry_correction_denied":
      return "You do not have permission to correct this time entry.";
    case "project_time_unavailable":
      return "Time tracking is not available for this project.";
    case "session_expired":
      return "Your session expired. Sign in and try again.";
    default:
      return "The time entry could not be saved.";
  }
}
function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}

export function ProjectTimeEntries({
  projectId,
  role,
  tasks,
  entries,
}: {
  projectId: string;
  role: "admin" | "member";
  tasks: Array<{ id: string; title: string }>;
  entries: TimeEntryView[];
}) {
  const [entryRows, setEntryRows] = useState(entries);
  const mutations = useOptimisticMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntryView | null>(null);
  const [taskId, setTaskId] = useState("");
  const [startedAt, setStartedAt] = useState<PickerValue>(() =>
    picker(new Date(Date.now() - 60 * 60 * 1000)),
  );
  const [endedAt, setEndedAt] = useState<PickerValue>(() => picker(new Date()));
  const [note, setNote] = useState("");
  const [billable, setBillable] = useState(false);
  const [reporting, setReporting] = useState<"internal" | "approved">(
    "internal",
  );
  const [error, setError] = useState<string | null>(null);
  const pending = editing
    ? mutations.isPending(`time-entry:${editing.id}`)
    : mutations.isPending("time-entry:create");
  const beginCreate = () => {
    setEditing(null);
    setTaskId(tasks[0]?.id ?? (role === "admin" ? PROJECT_LEVEL : ""));
    setStartedAt(picker(new Date(Date.now() - 60 * 60 * 1000)));
    setEndedAt(picker(new Date()));
    setNote("");
    setBillable(false);
    setReporting("internal");
    setError(null);
    setOpen(true);
  };
  const beginEdit = (entry: TimeEntryView) => {
    setEditing(entry);
    setTaskId(entry.taskId ?? PROJECT_LEVEL);
    setStartedAt(picker(new Date(entry.startedAt)));
    setEndedAt(picker(new Date(entry.endedAt)));
    setNote(entry.note ?? "");
    setBillable(entry.billable);
    setReporting(entry.clientReportingStatus);
    setError(null);
    setOpen(true);
  };
  const save = () => {
      const start = instant(startedAt);
      const end = instant(endedAt);
      if (!start || !end) {
        setError("Choose both a start and end date and time.");
        return;
      }
      const normalizedTaskId =
        taskId === PROJECT_LEVEL ? null : taskId || null;
      const normalizedNote = note.trim() || null;
      const payload = {
        projectId,
        taskId: normalizedTaskId,
        startedAt: start,
        endedAt: end,
        note: normalizedNote,
        billable,
        clientReportingStatus: reporting,
      };
      if (editing) {
        const originalStart = picker(new Date(editing.startedAt));
        const originalEnd = picker(new Date(editing.endedAt));
        const correction: Record<string, unknown> = {
          projectId,
          entryId: editing.id,
        };
        if (normalizedTaskId !== editing.taskId)
          correction.taskId = normalizedTaskId;
        if (!samePickerValue(startedAt, originalStart))
          correction.startedAt = start;
        if (!samePickerValue(endedAt, originalEnd)) correction.endedAt = end;
        if (normalizedNote !== editing.note) correction.note = normalizedNote;
        if (billable !== editing.billable) correction.billable = billable;
        if (reporting !== editing.clientReportingStatus)
          correction.clientReportingStatus = reporting;
        if (Object.keys(correction).length === 2) {
          setOpen(false);
          return;
        }
        const previous = editing;
        const projected: TimeEntryView = {
          ...editing,
          taskId: normalizedTaskId,
          taskTitle: normalizedTaskId ? tasks.find((task) => task.id === normalizedTaskId)?.title ?? "Unavailable task" : null,
          startedAt: start,
          endedAt: end,
          durationSeconds: Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)),
          note: normalizedNote,
          billable,
          clientReportingStatus: reporting,
          correctionCount: editing.correctionCount + 1,
        };
        setOpen(false);
        void mutations.run({
          scope: `time-entry:${editing.id}`,
          operation: "correct",
          snapshot: () => previous,
          optimistic: () => setEntryRows((current) => current.map((entry) => entry.id === previous.id ? projected : entry)),
          request: async () => {
            const response = await correctTimeEntryAction(correction);
            if (!response.ok) throw new Error(correctionError(response.code));
            return response.entry;
          },
          reconcile: (canonical) => setEntryRows((current) => current.map((entry) => entry.id === canonical.id ? canonical : entry)),
          rollback: (snapshot) => { setEntryRows((current) => current.map((entry) => entry.id === snapshot.id ? snapshot : entry)); setEditing(snapshot); setOpen(true); },
          errorMessage: (cause) => cause instanceof Error ? cause.message : "The time entry could not be saved.",
          onError: setError,
          retry: (cause) => cause instanceof Error && cause.message === "The time entry could not be saved.",
        });
      } else {
        const temporaryId = `pending-${crypto.randomUUID()}`;
        const projected: TimeEntryView = {
          id: temporaryId,
          taskId: normalizedTaskId,
          taskTitle: normalizedTaskId ? tasks.find((task) => task.id === normalizedTaskId)?.title ?? "Unavailable task" : null,
          userId: "pending",
          source: "manual",
          startedAt: start,
          endedAt: end,
          durationSeconds: Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)),
          note: normalizedNote,
          billable,
          clientReportingStatus: reporting,
          correctionCount: 0,
          canCorrect: true,
        };
        setOpen(false);
        void mutations.run({
          scope: "time-entry:create",
          operation: "create",
          snapshot: () => null,
          optimistic: () => setEntryRows((current) => [projected, ...current]),
          request: async () => {
            const response = await createManualTimeEntryAction(payload);
            if (!response.ok) throw new Error(correctionError(response.code));
            return response.entry;
          },
          reconcile: (canonical) => setEntryRows((current) => current.map((entry) => entry.id === temporaryId ? canonical : entry)),
          rollback: () => { setEntryRows((current) => current.filter((entry) => entry.id !== temporaryId)); setOpen(true); },
          errorMessage: (cause) => cause instanceof Error ? cause.message : "The time entry could not be saved.",
          onError: setError,
          retry: (cause) => cause instanceof Error && cause.message === "The time entry could not be saved.",
        });
      }
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Time entries</CardTitle>
              <CardDescription>
                Recent recorded work for this project.
              </CardDescription>
            </div>
            <Button size="sm" onClick={beginCreate}>
              <Plus />
              Add time
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entryRows.length === 0 ? (
            <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
              No time has been recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {entryRows.map((entry) => (
                <div
                  key={entry.id}
                  aria-busy={entry.id.startsWith("pending-") || mutations.isPending(`time-entry:${entry.id}`)}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
                >
                  <Clock3 className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {entry.taskTitle ?? "Project-level work"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(entry.startedAt))}{" "}
                      · {duration(entry.durationSeconds)}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={entry.billable ? "info" : "neutral"}>
                      {entry.billable ? "Billable" : "Non-billable"}
                    </StatusBadge>
                    <StatusBadge
                      tone={
                        entry.clientReportingStatus === "approved"
                          ? "success"
                          : "neutral"
                      }
                    >
                      {entry.clientReportingStatus === "approved"
                        ? "Client approved"
                        : "Internal"}
                    </StatusBadge>
                    {entry.canCorrect && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Correct time entry"
                        onClick={() => beginEdit(entry)}
                      >
                        <Pencil />
                      </Button>
                    )}
                    {(entry.id.startsWith("pending-") || mutations.isPending(`time-entry:${entry.id}`)) && (
                      <span className="text-xs text-muted-foreground">Saving…</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Correct time entry" : "Add time manually"}
            </DialogTitle>
            <DialogDescription>
              Duration is calculated and validated by the server. Corrections
              remain in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Task {role === "admin" ? "(optional)" : "(required)"}
              </Label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a task" />
                </SelectTrigger>
                <SelectContent>
                  {role === "admin" && (
                    <SelectItem value={PROJECT_LEVEL}>
                      Project-level work
                    </SelectItem>
                  )}
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Started</Label>
                <DateTimePicker
                  value={startedAt}
                  onValueChange={setStartedAt}
                  label="Start"
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label>Ended</Label>
                <DateTimePicker
                  value={endedAt}
                  onValueChange={setEndedAt}
                  label="End"
                  disabled={pending}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-note">Note</Label>
              <Textarea
                id="entry-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={billable}
                onCheckedChange={(checked) => setBillable(checked === true)}
              />
              Billable time
            </label>
            <div className="space-y-2">
              <Label>Client reporting</Label>
              <Select
                value={reporting}
                onValueChange={(value: "internal" | "approved") =>
                  setReporting(value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="approved">
                    Approved for client reporting
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={pending || !taskId} onClick={save}>
              {pending && <Loader2 className="animate-spin" />}
              {pending ? "Saving…" : editing ? "Save correction" : "Add time"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
