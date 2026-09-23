"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clock3,
  Loader2,
  PictureInPicture2,
  Play,
  Plus,
  Square,
} from "lucide-react";
import {
  createTimerTaskAction,
  loadTimerLaunchOptionsAction,
  loadTimerStateAction,
  startTimerAction,
  stopTimerAction,
  type TimerLaunchOptions,
  type TimerView,
} from "@/app/(app)/timer-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatElapsedTimer } from "@/domain/time/display";
import { projectIdFromProjectPath } from "@/domain/time/launcher";
import { toast } from "sonner";

const TIMER_CHANNEL = "time-log-active-timer";
const START_TIMER_EVENT = "time-log:start-timer";
const TASK_COMPLETED_EVENT = "time-log:task-completed";
const PROJECT_LEVEL = "__project_level__";

type TimerPrefill = { projectId?: string; taskId?: string };
type PictureInPictureApi = {
  requestWindow(options?: {
    width?: number;
    height?: number;
    preferInitialWindowPlacement?: boolean;
  }): Promise<Window>;
  window: Window | null;
};

function RunningTimer({ timer }: { timer: TimerView }) {
  const [now, setNow] = useState(() => new Date(timer.observedAt).getTime());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const startLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timer.startedAt));
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">
          {timer.projectKey ? `${timer.projectKey} · ` : ""}
          {timer.projectName} · Started{" "}
          <time suppressHydrationWarning>{startLabel}</time>
        </p>
        <p className="truncate text-sm font-medium">
          {timer.taskTitle ?? "Project-level work"}
        </p>
        {timer.note && (
          <p
            className="truncate text-xs text-muted-foreground"
            title={timer.note}
          >
            {timer.note}
          </p>
        )}
      </div>
      <Badge
        variant="secondary"
        className="font-mono tabular-nums"
        aria-label={`Elapsed time ${formatElapsedTimer(timer.startedAt, now)}`}
      >
        {formatElapsedTimer(timer.startedAt, now)}
      </Badge>
    </div>
  );
}

function DetachedTimer({
  timer,
  onStop,
}: {
  timer: TimerView;
  onStop(): Promise<string | null>;
}) {
  const [now, setNow] = useState(() => new Date(timer.observedAt).getTime());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const stop = async () => {
    setPending(true);
    setError(null);
    const message = await onStop();
    setPending(false);
    if (message) setError(message);
  };
  return (
    <main className="flex min-h-screen flex-col justify-between gap-4 bg-background p-4 text-foreground">
      <div>
        <p className="text-xs text-muted-foreground">
          {timer.projectKey ? `${timer.projectKey} · ` : ""}
          {timer.projectName}
        </p>
        <h1 className="mt-1 truncate text-base font-semibold">
          {timer.taskTitle ?? "Project-level work"}
        </h1>
        {timer.note && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {timer.note}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary" className="font-mono text-base tabular-nums">
          {formatElapsedTimer(timer.startedAt, now)}
        </Badge>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => void stop()}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Square />}
          {pending ? "Stopping…" : "Stop & save"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Saves as internal, non-billable time. Use Time Log for other options.
      </p>
    </main>
  );
}

export function GlobalTimerControl({
  initialTimer,
  canTrack,
}: {
  initialTimer: TimerView | null;
  canTrack: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [timer, setTimer] = useState(initialTimer);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<TimerLaunchOptions | null>(null);
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [note, setNote] = useState("");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncIssue, setSyncIssue] = useState<"session" | "network" | null>(
    null,
  );
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [creatingTask, startCreatingTask] = useTransition();
  const [starting, startStarting] = useTransition();
  const [stopOpen, setStopOpen] = useState(false);
  const [stopNote, setStopNote] = useState("");
  const [billable, setBillable] = useState(false);
  const [reportingStatus, setReportingStatus] = useState<
    "internal" | "approved"
  >("internal");
  const [completeTask, setCompleteTask] = useState(false);
  const [stopping, startStopping] = useTransition();
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipSupported, setPipSupported] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const refreshTimer = useCallback(async () => {
    try {
      const response = await loadTimerStateAction();
      if (response.ok) {
        setTimer(response.timer);
        setSyncIssue(null);
      } else if (response.code === "session_expired") setSyncIssue("session");
      else setSyncIssue("network");
    } catch {
      setSyncIssue("network");
    }
  }, []);

  const openLauncher = useCallback(async (prefill: TimerPrefill = {}) => {
    setOpen(true);
    setError(null);
    setLoadingOptions(true);
    try {
      const response = await loadTimerLaunchOptionsAction();
      if (!response.ok) {
        setError(
          response.code === "session_expired"
            ? "Your session expired. Sign in again to continue."
            : "Timer options could not be loaded. Try again.",
        );
        return;
      }
      setOptions(response.options);
      const contextualProjectId =
        prefill.projectId ?? projectIdFromProjectPath(pathname);
      const selectedProject =
        response.options.projects.find(
          (project) => project.id === contextualProjectId,
        ) ?? response.options.projects[0];
      setProjectId(selectedProject?.id ?? "");
      const selectedTask =
        selectedProject?.tasks.find((task) => task.id === prefill.taskId) ??
        selectedProject?.tasks[0];
      setTaskId(
        selectedTask?.id ??
          (response.options.role === "admin" ? PROJECT_LEVEL : ""),
      );
    } catch {
      setError(
        "Timer options could not be loaded. Check your connection and try again.",
      );
    } finally {
      setLoadingOptions(false);
    }
  }, [pathname]);

  useEffect(() => {
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(TIMER_CHANNEL);
    channelRef.current = channel;
    channel?.addEventListener("message", refreshTimer);
    const onFocus = () => void refreshTimer();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshTimer();
    };
    const onStart = (event: Event) =>
      void openLauncher((event as CustomEvent<TimerPrefill>).detail);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(START_TIMER_EVENT, onStart);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshTimer();
    }, 30_000);
    return () => {
      channel?.close();
      channelRef.current = null;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(START_TIMER_EVENT, onStart);
      window.clearInterval(interval);
    };
  }, [openLauncher, refreshTimer]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPipSupported(
        "documentPictureInPicture" in window && window.isSecureContext,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!timer && pipWindow && !pipWindow.closed) pipWindow.close();
  }, [pipWindow, timer]);

  useEffect(
    () => () => {
      if (pipWindow && !pipWindow.closed) pipWindow.close();
    },
    [pipWindow],
  );

  useEffect(() => {
    if (!timer) return;
    const originalTitle = document.title;
    const updateTitle = () => {
      document.title = `${formatElapsedTimer(timer.startedAt, Date.now())} · ${timer.taskTitle ?? timer.projectName}`;
    };
    updateTitle();
    const interval = window.setInterval(updateTitle, 1000);
    return () => {
      window.clearInterval(interval);
      document.title = originalTitle;
    };
  }, [timer]);

  const selectedProject = options?.projects.find(
    (project) => project.id === projectId,
  );
  const canStart = Boolean(
    projectId &&
      (options?.role === "admin" || (taskId && taskId !== PROJECT_LEVEL)),
  );

  if (!timer && !canTrack) return null;

  const createQuickTask = () =>
    startCreatingTask(async () => {
      setError(null);
      try {
        const response = await createTimerTaskAction({
          projectId,
          title: quickTaskTitle,
        });
        if (!response.ok) {
          setError(
            response.code === "session_expired"
              ? "Your session expired. Sign in again to continue."
              : "The task could not be created.",
          );
          return;
        }
        setOptions((current) =>
          current
            ? {
                ...current,
                projects: current.projects.map((project) =>
                  project.id === projectId
                    ? { ...project, tasks: [...project.tasks, response.task] }
                    : project,
                ),
              }
            : current,
        );
        setTaskId(response.task.id);
        setQuickTaskTitle("");
      } catch {
        setError(
          "The task could not be created. Check your connection and try again.",
        );
      }
    });

  const beginTimer = () =>
    startStarting(async () => {
      setError(null);
      try {
        const response = await startTimerAction({
          projectId,
          taskId: taskId === PROJECT_LEVEL ? null : taskId || null,
          note: note.trim() || null,
        });
        if (response.ok) {
          setTimer(response.timer);
          setOpen(false);
          channelRef.current?.postMessage({ type: "timer-changed" });
          return;
        }
        if (response.code === "timer_already_active") {
          await refreshTimer();
          setOpen(false);
          return;
        }
        setError(
          response.code === "session_expired"
            ? "Your session expired. Sign in again to continue."
            : response.code === "timer_task_required"
              ? "Select or create a saved task before starting."
              : response.code === "timer_denied"
                ? "You no longer have permission to track time here."
                : "The timer could not be started. Check your connection and try again.",
        );
      } catch {
        setError(
          "The timer could not be started. Check your connection and try again.",
        );
      }
    });

  const openStop = () => {
    setStopNote(timer?.note ?? "");
    setBillable(false);
    setReportingStatus("internal");
    setCompleteTask(false);
    setError(null);
    setStopOpen(true);
  };
  const finishTimer = () =>
    startStopping(async () => {
      setError(null);
      try {
        const response = await stopTimerAction({
          note: stopNote.trim() || null,
          billable,
          clientReportingStatus: reportingStatus,
          completeTask,
        });
        if (!response.ok) {
          setError(
            response.code === "session_expired"
              ? "Your session expired. Sign in again to continue."
              : response.code === "time_duration_unreasonable"
                ? "This timer is too long to stop automatically. Contact an administrator to recover it."
                : ["task_archived", "project_tasks_read_only", "task_manage_denied", "timer_task_not_found"].includes(response.code)
                  ? "The task can no longer be completed. Uncheck task completion and try stopping again."
                : "The timer could not be stopped. Try again.",
          );
          return;
        }
        if (response.taskCompleted && timer?.taskId) window.dispatchEvent(new CustomEvent(TASK_COMPLETED_EVENT, { detail: { taskId: timer.taskId } }));
        setTimer(null);
        setStopOpen(false);
        channelRef.current?.postMessage({ type: "timer-changed" });
        router.refresh();
      } catch {
        setError(
          "The timer could not be stopped. Check your connection and try again.",
        );
      }
    });

  const stopFromDetachedWindow = async () => {
    try {
      const response = await stopTimerAction({
        note: timer?.note ?? null,
        billable: false,
        clientReportingStatus: "internal",
        completeTask: false,
      });
      if (!response.ok) {
        return response.code === "session_expired"
          ? "Your session expired. Sign in from Time Log to continue."
          : response.code === "time_duration_unreasonable"
            ? "This timer is too long to stop automatically. Contact an administrator."
            : "The timer could not be stopped. Try again.";
      }
      setTimer(null);
      channelRef.current?.postMessage({ type: "timer-changed" });
      router.refresh();
      return null;
    } catch {
      return "The timer could not be stopped. Check your connection and try again.";
    }
  };

  const openPictureInPicture = async () => {
    try {
      const api = (
        window as Window & { documentPictureInPicture?: PictureInPictureApi }
      ).documentPictureInPicture;
      if (!api) return;
      if (api.window && !api.window.closed) {
        api.window.focus();
        return;
      }
      const detached = await api.requestWindow({
        width: 360,
        height: 190,
        preferInitialWindowPlacement: false,
      });
      document
        .querySelectorAll('link[rel="stylesheet"], style')
        .forEach((node) => detached.document.head.append(node.cloneNode(true)));
      detached.document.documentElement.lang = document.documentElement.lang;
      detached.document.documentElement.className =
        document.documentElement.className;
      detached.document.body.className = "bg-background text-foreground";
      detached.document.title = "Active timer · Time Log";
      detached.addEventListener("pagehide", () => setPipWindow(null), {
        once: true,
      });
      setPipWindow(detached);
    } catch {
      toast.error(
        "The always-on-top timer could not be opened. Check your browser's Picture-in-Picture permissions.",
      );
    }
  };

  return (
    <>
      <aside
        className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur"
        aria-label="Global timer"
      >
        {timer ? (
          <>
            <RunningTimer timer={timer} />
            <div className="flex shrink-0 items-center gap-1">
              {pipSupported && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Keep timer visible"
                  title="Keep timer visible"
                  onClick={() => void openPictureInPicture()}
                >
                  <PictureInPicture2 />
                </Button>
              )}
              {syncIssue === "session" ? (
                <Badge variant="destructive" asChild>
                  <Link href="/login">Sign in</Link>
                </Badge>
              ) : syncIssue === "network" ? (
                <Badge variant="outline">Offline</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={openStop}>
                  <Square />
                  Stop
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <Clock3 className="size-4 text-muted-foreground" />
              <span>
                {syncIssue === "network"
                  ? "Timer status offline"
                  : "No timer running"}
              </span>
            </div>
            {syncIssue === "session" ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            ) : (
              <Button size="sm" onClick={() => void openLauncher()}>
                <Play />
                Start timer
              </Button>
            )}
          </>
        )}
      </aside>
      <Dialog open={open} onOpenChange={(next) => !starting && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a timer</DialogTitle>
            <DialogDescription>
              Select the saved work you are starting. Your timer continues
              across pages and tabs.
            </DialogDescription>
          </DialogHeader>
          {loadingOptions ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" />
              Loading projects and tasks…
            </div>
          ) : options?.projects.length === 0 ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              No active projects with Time tracking are available.
            </div>
          ) : (
            <div className="min-w-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timer-project">Project</Label>
                <Select
                  value={projectId}
                  onValueChange={(value) => {
                    setProjectId(value);
                    const project = options?.projects.find(
                      (candidate) => candidate.id === value,
                    );
                    setTaskId(
                      project?.tasks[0]?.id ??
                        (options?.role === "admin" ? PROJECT_LEVEL : ""),
                    );
                    setError(null);
                  }}
                >
                  <SelectTrigger id="timer-project" className="w-full">
                    <SelectValue placeholder="Choose a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.key} · {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timer-task">
                  Task{" "}
                  {options?.role === "admin" ? "(recommended)" : "(required)"}
                </Label>
                <Select
                  value={taskId}
                  onValueChange={setTaskId}
                  disabled={!projectId}
                >
                  <SelectTrigger id="timer-task" className="w-full">
                    <SelectValue placeholder="Choose a saved task" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.role === "admin" && (
                      <SelectItem value={PROJECT_LEVEL}>
                        Project-level work
                      </SelectItem>
                    )}
                    {selectedProject?.tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProject?.canCreateTask && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <Label htmlFor="timer-new-task">Create a task first</Label>
                  <div className="flex min-w-0 gap-2">
                    <Input
                      id="timer-new-task"
                      value={quickTaskTitle}
                      onChange={(event) =>
                        setQuickTaskTitle(event.target.value)
                      }
                      placeholder="What will you work on?"
                      maxLength={240}
                      disabled={creatingTask || starting}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        !quickTaskTitle.trim() || creatingTask || starting
                      }
                      onClick={createQuickTask}
                    >
                      {creatingTask ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Plus />
                      )}
                      <span className="sr-only sm:not-sr-only">
                        {creatingTask ? "Creating…" : "Create"}
                      </span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    New tasks are assigned to you and remain internal by
                    default.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="timer-note">Work note (optional)</Label>
                <Textarea
                  id="timer-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add context for this work session"
                  maxLength={2000}
                  disabled={starting}
                />
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}{" "}
              {error.includes("session expired") && (
                <Link className="underline" href="/login">
                  Sign in
                </Link>
              )}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={starting}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!canStart || starting || loadingOptions}
              onClick={beginTimer}
            >
              {starting ? <Loader2 className="animate-spin" /> : <Play />}
              {starting ? "Starting…" : "Start timer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={stopOpen}
        onOpenChange={(next) => !stopping && setStopOpen(next)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop timer and save time?</DialogTitle>
            <DialogDescription>
              The server will calculate the final duration and create a time
              entry for {timer?.taskTitle ?? "this project"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stop-note">Work note</Label>
              <Textarea
                id="stop-note"
                value={stopNote}
                onChange={(event) => setStopNote(event.target.value)}
                maxLength={2000}
                disabled={stopping}
              />
            </div>
            {timer?.taskId && (
              <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <Checkbox
                  checked={completeTask}
                  onCheckedChange={(checked) =>
                    setCompleteTask(checked === true)
                  }
                  disabled={stopping}
                />
                <span>
                  <span className="font-medium">
                    Mark “{timer.taskTitle ?? "this task"}” as completed
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    The task and time entry will be saved together.
                  </span>
                </span>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={billable}
                onCheckedChange={(checked) => setBillable(checked === true)}
                disabled={stopping}
              />
              Billable time
            </label>
            <div className="space-y-2">
              <Label htmlFor="reporting-status">Client reporting</Label>
              <Select
                value={reportingStatus}
                onValueChange={(value: "internal" | "approved") =>
                  setReportingStatus(value)
                }
                disabled={stopping}
              >
                <SelectTrigger id="reporting-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="approved">
                    Approved for client reporting
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Approval makes this entry eligible for future client-safe
                reports; it does not grant project access.
              </p>
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
              disabled={stopping}
              onClick={() => setStopOpen(false)}
            >
              Keep running
            </Button>
            <Button disabled={stopping} onClick={finishTimer}>
              {stopping ? <Loader2 className="animate-spin" /> : <Square />}
              {stopping
                ? "Stopping…"
                : completeTask
                  ? "Stop, save & complete"
                  : "Stop and save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {pipWindow &&
        timer &&
        createPortal(
          <DetachedTimer timer={timer} onStop={stopFromDetachedWindow} />,
          pipWindow.document.body,
        )}
    </>
  );
}

export function requestTimerStart(prefill: TimerPrefill = {}) {
  window.dispatchEvent(new CustomEvent(START_TIMER_EVENT, { detail: prefill }));
}
