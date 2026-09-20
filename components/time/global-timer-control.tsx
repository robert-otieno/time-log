"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Clock3, Loader2, Play, Plus } from "lucide-react";
import { createTimerTaskAction, loadTimerLaunchOptionsAction, loadTimerStateAction, startTimerAction, type TimerLaunchOptions, type TimerView } from "@/app/(app)/timer-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatElapsedTimer } from "@/domain/time/display";

const TIMER_CHANNEL = "time-log-active-timer";
const START_TIMER_EVENT = "time-log:start-timer";
const PROJECT_LEVEL = "__project_level__";

type TimerPrefill = { projectId?: string; taskId?: string };

function RunningTimer({ timer }: { timer: TimerView }) {
  const [now, setNow] = useState(() => new Date(timer.observedAt).getTime());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const startLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(timer.startedAt));
  return <div className="flex min-w-0 items-center gap-3"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" /><span className="relative inline-flex size-2 rounded-full bg-primary" /></span><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{timer.projectKey ? `${timer.projectKey} · ` : ""}{timer.projectName} · Started <time suppressHydrationWarning>{startLabel}</time></p><p className="truncate text-sm font-medium">{timer.taskTitle ?? "Project-level work"}</p>{timer.note && <p className="truncate text-xs text-muted-foreground" title={timer.note}>{timer.note}</p>}</div><Badge variant="secondary" className="font-mono tabular-nums" aria-label={`Elapsed time ${formatElapsedTimer(timer.startedAt, now)}`}>{formatElapsedTimer(timer.startedAt, now)}</Badge></div>;
}

export function GlobalTimerControl({ initialTimer, canTrack }: { initialTimer: TimerView | null; canTrack: boolean }) {
  const [timer, setTimer] = useState(initialTimer);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<TimerLaunchOptions | null>(null);
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [note, setNote] = useState("");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncIssue, setSyncIssue] = useState<"session" | "network" | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [creatingTask, startCreatingTask] = useTransition();
  const [starting, startStarting] = useTransition();
  const channelRef = useRef<BroadcastChannel | null>(null);

  const refreshTimer = useCallback(async () => {
    try {
      const response = await loadTimerStateAction();
      if (response.ok) { setTimer(response.timer); setSyncIssue(null); }
      else if (response.code === "session_expired") setSyncIssue("session");
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
        setError(response.code === "session_expired" ? "Your session expired. Sign in again to continue." : "Timer options could not be loaded. Try again.");
        return;
      }
      setOptions(response.options);
      const selectedProject = response.options.projects.find((project) => project.id === prefill.projectId) ?? response.options.projects[0];
      setProjectId(selectedProject?.id ?? "");
      const selectedTask = selectedProject?.tasks.find((task) => task.id === prefill.taskId) ?? selectedProject?.tasks[0];
      setTaskId(selectedTask?.id ?? (response.options.role === "admin" ? PROJECT_LEVEL : ""));
    } catch {
      setError("Timer options could not be loaded. Check your connection and try again.");
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(TIMER_CHANNEL);
    channelRef.current = channel;
    channel?.addEventListener("message", refreshTimer);
    const onFocus = () => void refreshTimer();
    const onVisibility = () => { if (document.visibilityState === "visible") void refreshTimer(); };
    const onStart = (event: Event) => void openLauncher((event as CustomEvent<TimerPrefill>).detail);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(START_TIMER_EVENT, onStart);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refreshTimer(); }, 30_000);
    return () => {
      channel?.close();
      channelRef.current = null;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(START_TIMER_EVENT, onStart);
      window.clearInterval(interval);
    };
  }, [openLauncher, refreshTimer]);

  const selectedProject = options?.projects.find((project) => project.id === projectId);
  const canStart = Boolean(projectId && (options?.role === "admin" || (taskId && taskId !== PROJECT_LEVEL)));

  if (!timer && !canTrack) return null;

  const createQuickTask = () => startCreatingTask(async () => {
    setError(null);
    try {
      const response = await createTimerTaskAction({ projectId, title: quickTaskTitle });
      if (!response.ok) {
        setError(response.code === "session_expired" ? "Your session expired. Sign in again to continue." : "The task could not be created.");
        return;
      }
      setOptions((current) => current ? { ...current, projects: current.projects.map((project) => project.id === projectId ? { ...project, tasks: [...project.tasks, response.task] } : project) } : current);
      setTaskId(response.task.id);
      setQuickTaskTitle("");
    } catch {
      setError("The task could not be created. Check your connection and try again.");
    }
  });

  const beginTimer = () => startStarting(async () => {
    setError(null);
    try {
      const response = await startTimerAction({ projectId, taskId: taskId === PROJECT_LEVEL ? null : taskId || null, note: note.trim() || null });
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
      setError(response.code === "session_expired" ? "Your session expired. Sign in again to continue." : response.code === "timer_task_required" ? "Select or create a saved task before starting." : response.code === "timer_denied" ? "You no longer have permission to track time here." : "The timer could not be started. Check your connection and try again.");
    } catch {
      setError("The timer could not be started. Check your connection and try again.");
    }
  });

  return <><aside className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:top-2 sm:right-52 sm:bottom-auto sm:max-w-sm" aria-label="Global timer">
    {timer ? <><RunningTimer timer={timer} />{syncIssue === "session" ? <Badge variant="destructive" asChild><Link href="/login">Sign in</Link></Badge> : syncIssue === "network" ? <Badge variant="outline">Offline</Badge> : <Button asChild size="sm" variant="ghost"><Link href={`/projects/${timer.projectId}/time`}>View</Link></Button>}</> : <><div className="flex items-center gap-2 text-sm"><Clock3 className="size-4 text-muted-foreground" /><span>{syncIssue === "network" ? "Timer status offline" : "No timer running"}</span></div>{syncIssue === "session" ? <Button asChild size="sm" variant="outline"><Link href="/login">Sign in</Link></Button> : <Button size="sm" onClick={() => void openLauncher()}><Play />Start timer</Button>}</>}
  </aside>
  <Dialog open={open} onOpenChange={(next) => !starting && setOpen(next)}><DialogContent><DialogHeader><DialogTitle>Start a timer</DialogTitle><DialogDescription>Select the saved work you are starting. Your timer continues across pages and tabs.</DialogDescription></DialogHeader>
      {loadingOptions ? <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground"><Loader2 className="animate-spin" />Loading projects and tasks…</div> : options?.projects.length === 0 ? <div className="rounded-lg border p-4 text-sm text-muted-foreground">No active projects with Time tracking are available.</div> : <div className="space-y-4"><div className="space-y-2"><Label htmlFor="timer-project">Project</Label><Select value={projectId} onValueChange={(value) => { setProjectId(value); const project = options?.projects.find((candidate) => candidate.id === value); setTaskId(project?.tasks[0]?.id ?? (options?.role === "admin" ? PROJECT_LEVEL : "")); setError(null); }}><SelectTrigger id="timer-project" className="w-full"><SelectValue placeholder="Choose a project" /></SelectTrigger><SelectContent>{options?.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.key} · {project.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="timer-task">Task {options?.role === "admin" ? "(recommended)" : "(required)"}</Label><Select value={taskId} onValueChange={setTaskId} disabled={!projectId}><SelectTrigger id="timer-task" className="w-full"><SelectValue placeholder="Choose a saved task" /></SelectTrigger><SelectContent>{options?.role === "admin" && <SelectItem value={PROJECT_LEVEL}>Project-level work</SelectItem>}{selectedProject?.tasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}</SelectContent></Select></div>
      {selectedProject?.canCreateTask && <div className="space-y-2 rounded-lg border bg-muted/30 p-3"><Label htmlFor="timer-new-task">Create a task first</Label><div className="flex gap-2"><Input id="timer-new-task" value={quickTaskTitle} onChange={(event) => setQuickTaskTitle(event.target.value)} placeholder="What will you work on?" maxLength={240} disabled={creatingTask || starting} /><Button type="button" variant="outline" disabled={!quickTaskTitle.trim() || creatingTask || starting} onClick={createQuickTask}>{creatingTask ? <Loader2 className="animate-spin" /> : <Plus />}<span className="sr-only sm:not-sr-only">{creatingTask ? "Creating…" : "Create"}</span></Button></div><p className="text-xs text-muted-foreground">New tasks are assigned to you and remain internal by default.</p></div>}
      <div className="space-y-2"><Label htmlFor="timer-note">Work note (optional)</Label><Textarea id="timer-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context for this work session" maxLength={2000} disabled={starting} /></div></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error} {error.includes("session expired") && <Link className="underline" href="/login">Sign in</Link>}</p>}
    <DialogFooter><Button variant="outline" disabled={starting} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!canStart || starting || loadingOptions} onClick={beginTimer}>{starting ? <Loader2 className="animate-spin" /> : <Play />}{starting ? "Starting…" : "Start timer"}</Button></DialogFooter>
  </DialogContent></Dialog></>;
}

export function requestTimerStart(prefill: TimerPrefill = {}) {
  window.dispatchEvent(new CustomEvent(START_TIMER_EVENT, { detail: prefill }));
}
