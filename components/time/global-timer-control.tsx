"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BellRing,
  Clock3,
  Loader2,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Square,
} from "lucide-react";
import {
  createTimerTaskAction,
  claimDueTimerAlarmAction,
  configureTimerAlarmAction,
  dismissTimerAlarmAction,
  loadTimerLaunchOptionsAction,
  loadTimerStateAction,
  pauseTimerAction,
  pauseTimerForInactivityAction,
  resumeTimerAction,
  snoozeTimerAlarmAction,
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
import { formatDurationSeconds } from "@/domain/time/display";
import { INACTIVITY_RESPONSE_MS, INACTIVITY_THRESHOLD_MS, inactivityResponseSeconds, shouldWarnForVisiblePage } from "@/domain/time/inactivity";
import { projectIdFromProjectPath } from "@/domain/time/launcher";
import { toast } from "sonner";

const TIMER_CHANNEL = "time-log-active-timer";
const TIMER_SYNC_STORAGE_KEY = "time-log:active-timer-sync";
const START_TIMER_EVENT = "time-log:start-timer";
const TASK_COMPLETED_EVENT = "time-log:task-completed";
const PROJECT_LEVEL = "__project_level__";

type TimerPrefill = { projectId?: string; taskId?: string };
type TimerSyncMessage = {
  type: "timer-started" | "timer-stopping" | "timer-stopped" | "timer-stop-failed" | "timer-changed";
  sentAt: number;
};
type PictureInPictureApi = {
  requestWindow(options?: {
    width?: number;
    height?: number;
    preferInitialWindowPlacement?: boolean;
  }): Promise<Window>;
  window: Window | null;
};

type IdleDetectorInstance = EventTarget & {
  userState: "active" | "idle" | null;
  screenState: "locked" | "unlocked" | null;
  start(options: { threshold: number; signal: AbortSignal }): Promise<void>;
};

type IdleDetectorConstructor = {
  new (): IdleDetectorInstance;
  requestPermission(): Promise<"granted" | "denied">;
};

function visibleTimerSeconds(timer: TimerView, now: number) {
  return timer.elapsedSeconds + (timer.state === "running"
    ? Math.max(0, Math.floor((now - new Date(timer.observedAt).getTime()) / 1000))
    : 0);
}

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
          {timer.projectName} · {timer.state === "paused" ? "Paused" : "Started"}{" "}
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
        aria-label={`Elapsed time ${formatDurationSeconds(visibleTimerSeconds(timer, now))}`}
      >
        {formatDurationSeconds(visibleTimerSeconds(timer, now))}
      </Badge>
    </div>
  );
}

function DetachedTimer({
  timer,
  onStop,
  onTogglePause,
  inactivityCountdown,
  onStillWorking,
}: {
  timer: TimerView;
  onStop(): Promise<string | null>;
  onTogglePause(): Promise<string | null>;
  inactivityCountdown: number | null;
  onStillWorking(): void;
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
  const togglePause = async () => {
    setPending(true);
    setError(null);
    const message = await onTogglePause();
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
        {inactivityCountdown !== null && (
          <div role="alert" className="mt-3 rounded-lg border bg-muted/40 p-3">
            <p className="text-sm font-medium">Still working?</p>
            <p className="mt-1 text-xs text-muted-foreground">Automatic pause in {inactivityCountdown} seconds.</p>
            <Button size="sm" className="mt-2" onClick={onStillWorking}>
              <Activity />
              I’m still working
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary" className="font-mono text-base tabular-nums">
          {formatDurationSeconds(visibleTimerSeconds(timer, now))}
        </Badge>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => void togglePause()}>
          {pending ? <Loader2 className="animate-spin" /> : timer.state === "running" ? <Pause /> : <Play />}
          {timer.state === "running" ? "Pause" : "Resume"}
        </Button>
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
  const [reminderMinutes, setReminderMinutes] = useState("none");
  const [customReminderMinutes, setCustomReminderMinutes] = useState("90");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncIssue, setSyncIssue] = useState<"session" | "network" | null>(
    null,
  );
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [creatingTask, startCreatingTask] = useTransition();
  const [stopOpen, setStopOpen] = useState(false);
  const [stopNote, setStopNote] = useState("");
  const [billable, setBillable] = useState(false);
  const [reportingStatus, setReportingStatus] = useState<
    "internal" | "approved"
  >("internal");
  const [completeTask, setCompleteTask] = useState(false);
  const [stopping, startStopping] = useTransition();
  const [stopSaving, setStopSaving] = useState(false);
  const [remoteStopPending, setRemoteStopPending] = useState(false);
  const [idleSupported, setIdleSupported] = useState(false);
  const [idlePermission, setIdlePermission] = useState<"granted" | "denied" | "prompt" | "unsupported">("unsupported");
  const [inactivityWarning, setInactivityWarning] = useState<{ detectedAt: string; deadline: number } | null>(null);
  const [inactivityCountdown, setInactivityCountdown] = useState(30);
  const [inactivityRecoveryOpen, setInactivityRecoveryOpen] = useState(
    () => initialTimer?.state === "paused" && initialTimer.pauseReason === "inactivity",
  );
  const [autoPausing, setAutoPausing] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipSupported, setPipSupported] = useState(false);
  const [alarmOpen, setAlarmOpen] = useState(false);
  const [alarmSaving, setAlarmSaving] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const pipSyncCleanupRef = useRef<() => void>(() => undefined);
  const lastActivityRef = useRef(0);
  const warningRef = useRef<typeof inactivityWarning>(null);
  const deviceIdleRef = useRef(false);
  const inactivitySuppressedUntilRef = useRef(0);
  const remoteStopPendingRef = useRef(false);
  const timerCommandTailRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const timerCommandPendingRef = useRef(0);
  const timerCommandSequenceRef = useRef(0);
  const alarmClaimingRef = useRef(false);
  const [timerCommandPending, setTimerCommandPending] = useState(0);
  const changingState = timerCommandPending > 0;
  const starting = changingState && timer?.organizationId === "pending";

  const closePictureInPicture = useCallback(() => {
    const detached = pipWindowRef.current;
    pipSyncCleanupRef.current();
    pipSyncCleanupRef.current = () => undefined;
    pipWindowRef.current = null;
    if (detached && !detached.closed) detached.close();
    setPipWindow(null);
  }, []);

  const refreshTimer = useCallback(async () => {
    if (stopSaving || remoteStopPendingRef.current || timerCommandPendingRef.current > 0) return;
    try {
      const response = await loadTimerStateAction();
      if (response.ok) {
        setTimer(response.timer);
        if (response.timer?.state === "paused" && response.timer.pauseReason === "inactivity") setInactivityRecoveryOpen(true);
        if (!response.timer) closePictureInPicture();
        setSyncIssue(null);
      } else if (response.code === "session_expired") setSyncIssue("session");
      else setSyncIssue("network");
    } catch {
      setSyncIssue("network");
    }
  }, [closePictureInPicture, stopSaving]);

  const handleTimerSync = useCallback(
    (message: TimerSyncMessage) => {
      if (message.type === "timer-stopping") {
        remoteStopPendingRef.current = true;
        setRemoteStopPending(true);
        setTimer(null);
        setStopOpen(false);
        closePictureInPicture();
        return;
      }
      if (message.type === "timer-stopped") {
        remoteStopPendingRef.current = false;
        setRemoteStopPending(false);
        setTimer(null);
        setStopOpen(false);
        closePictureInPicture();
        return;
      }
      if (message.type === "timer-stop-failed") {
        remoteStopPendingRef.current = false;
        setRemoteStopPending(false);
      }
      void refreshTimer();
    },
    [closePictureInPicture, refreshTimer],
  );

  const publishTimerSync = useCallback(
    (type: TimerSyncMessage["type"]) => {
      const message: TimerSyncMessage = { type, sentAt: Date.now() };
      if (type === "timer-stopping" || type === "timer-stopped") closePictureInPicture();
      channelRef.current?.postMessage(message);
      try {
        window.localStorage.setItem(TIMER_SYNC_STORAGE_KEY, JSON.stringify(message));
      } catch {
        // BroadcastChannel remains the primary synchronization path.
      }
    },
    [closePictureInPicture],
  );

  const beginInactivityWarning = useCallback(() => {
    if (warningRef.current || Date.now() < inactivitySuppressedUntilRef.current) return;
    const detectedAt = new Date().toISOString();
    const warning = { detectedAt, deadline: Date.now() + INACTIVITY_RESPONSE_MS };
    warningRef.current = warning;
    setInactivityWarning(warning);
    setInactivityCountdown(30);
  }, []);

  const clearInactivityWarning = useCallback(() => {
    warningRef.current = null;
    setInactivityWarning(null);
  }, []);

  const confirmStillWorking = useCallback(() => {
    clearInactivityWarning();
    lastActivityRef.current = Date.now();
    inactivitySuppressedUntilRef.current = Date.now() + INACTIVITY_THRESHOLD_MS;
  }, [clearInactivityWarning]);

  const autoPauseForInactivity = useCallback(async (detectedAt: string) => {
    if (autoPausing) return;
    setAutoPausing(true);
    try {
      const response = await pauseTimerForInactivityAction({ effectiveAt: detectedAt });
      if (!response.ok) {
        if (response.code !== "timer_not_active") toast.error("The timer could not be paused after inactivity. Please pause or stop it manually.");
        await refreshTimer();
        return;
      }
      setTimer(response.timer);
      clearInactivityWarning();
      setInactivityRecoveryOpen(true);
      publishTimerSync("timer-changed");
    } catch {
      toast.error("The timer could not be paused after inactivity. Please pause or stop it manually.");
    } finally {
      setAutoPausing(false);
    }
  }, [autoPausing, clearInactivityWarning, publishTimerSync, refreshTimer]);

  useEffect(() => {
    warningRef.current = inactivityWarning;
  }, [inactivityWarning]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const constructor = (window as Window & { IdleDetector?: IdleDetectorConstructor }).IdleDetector;
      if (!constructor || !window.isSecureContext) return;
      setIdleSupported(true);
      void navigator.permissions
        .query({ name: "idle-detection" as PermissionName })
        .then((status) => {
          setIdlePermission(status.state);
          status.addEventListener("change", () => setIdlePermission(status.state), { once: true });
        })
        .catch(() => setIdlePermission("prompt"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/timer-alarm-sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!timer || timer.state !== "running" || idlePermission !== "granted") {
      deviceIdleRef.current = false;
      return;
    }
    const Constructor = (window as Window & { IdleDetector?: IdleDetectorConstructor }).IdleDetector;
    if (!Constructor) return;
    const controller = new AbortController();
    const detector = new Constructor();
    const handleChange = () => {
      deviceIdleRef.current = detector.userState === "idle" || detector.screenState === "locked";
      if (deviceIdleRef.current) beginInactivityWarning();
      else lastActivityRef.current = Date.now();
    };
    detector.addEventListener("change", handleChange);
    void detector.start({ threshold: INACTIVITY_THRESHOLD_MS, signal: controller.signal }).catch(() => setIdlePermission("denied"));
    return () => {
      controller.abort();
      detector.removeEventListener("change", handleChange);
      deviceIdleRef.current = false;
    };
  }, [beginInactivityWarning, idlePermission, timer]);

  useEffect(() => {
    if (!timer || timer.state !== "running") {
      const frame = window.requestAnimationFrame(clearInactivityWarning);
      return () => window.cancelAnimationFrame(frame);
    }
    if (lastActivityRef.current === 0) lastActivityRef.current = Date.now();
    const recordActivity = () => {
      if (document.visibilityState === "visible" && !warningRef.current) lastActivityRef.current = Date.now();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") lastActivityRef.current = Date.now();
    };
    window.addEventListener("pointerdown", recordActivity, { passive: true });
    window.addEventListener("keydown", recordActivity);
    window.addEventListener("touchstart", recordActivity, { passive: true });
    window.addEventListener("scroll", recordActivity, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(() => {
      if (warningRef.current || Date.now() < inactivitySuppressedUntilRef.current) return;
      if (idlePermission === "granted") {
        if (deviceIdleRef.current) beginInactivityWarning();
      } else if (shouldWarnForVisiblePage({ visible: document.visibilityState === "visible", now: Date.now(), lastActivityAt: lastActivityRef.current, suppressedUntil: inactivitySuppressedUntilRef.current, warningOpen: Boolean(warningRef.current) })) {
        beginInactivityWarning();
      }
    }, 1000);
    return () => {
      window.removeEventListener("pointerdown", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("touchstart", recordActivity);
      window.removeEventListener("scroll", recordActivity);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [beginInactivityWarning, clearInactivityWarning, idlePermission, timer]);

  useEffect(() => {
    if (!inactivityWarning || !timer || timer.state !== "running") return;
    const tick = () => {
      const remaining = inactivityResponseSeconds(inactivityWarning.deadline, Date.now());
      setInactivityCountdown(remaining);
      if (remaining === 0) void autoPauseForInactivity(inactivityWarning.detectedAt);
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [autoPauseForInactivity, inactivityWarning, timer]);

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
    const onChannelMessage = (event: MessageEvent<TimerSyncMessage>) => {
      if (event.data?.type) handleTimerSync(event.data);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== TIMER_SYNC_STORAGE_KEY || !event.newValue) return;
      try {
        const message = JSON.parse(event.newValue) as TimerSyncMessage;
        if (message?.type) handleTimerSync(message);
      } catch {
        void refreshTimer();
      }
    };
    channel?.addEventListener("message", onChannelMessage);
    const onFocus = () => void refreshTimer();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshTimer();
    };
    const onStart = (event: Event) =>
      void openLauncher((event as CustomEvent<TimerPrefill>).detail);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(START_TIMER_EVENT, onStart);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshTimer();
    }, 30_000);
    return () => {
      channel?.close();
      channelRef.current = null;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(START_TIMER_EVENT, onStart);
      window.clearInterval(interval);
    };
  }, [handleTimerSync, openLauncher, refreshTimer]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPipSupported(
        "documentPictureInPicture" in window && window.isSecureContext,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => closePictureInPicture(),
    [closePictureInPicture],
  );

  useEffect(() => {
    if (!timer) return;
    const originalTitle = document.title;
    const updateTitle = () => {
      document.title = `${timer.state === "paused" ? "Paused · " : ""}${formatDurationSeconds(visibleTimerSeconds(timer, Date.now()))} · ${timer.taskTitle ?? timer.projectName}`;
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
      (options?.role === "admin" || (taskId && taskId !== PROJECT_LEVEL)) &&
      (reminderMinutes !== "custom" || (Number(customReminderMinutes) >= 1 && Number(customReminderMinutes) <= 480)),
  );

  const savingTimer = stopSaving || remoteStopPending;

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

  const beginTimer = () => {
    const project = selectedProject;
    if (!project) return;
    const task = project.tasks.find((candidate) => candidate.id === taskId);
    const previous = timer;
    const observedAt = new Date().toISOString();
    const optimisticTimer: TimerView = {
      organizationId: "pending",
      projectId: project.id,
      projectName: project.name,
      projectKey: project.key,
      taskId: taskId === PROJECT_LEVEL ? null : taskId || null,
      taskTitle: task?.title ?? null,
      note: note.trim() || null,
      startedAt: observedAt,
      observedAt,
      state: "running",
      elapsedSeconds: 0,
      pauseReason: null,
      alarm: (() => {
        const minutes = reminderMinutes === "custom" ? Number(customReminderMinutes) : reminderMinutes === "none" ? 0 : Number(reminderMinutes);
        return Number.isInteger(minutes) && minutes >= 1 && minutes <= 480 ? { durationSeconds: minutes * 60, dueAtTrackedSeconds: minutes * 60, status: "armed", triggeredAt: null, acknowledgedAt: null, snoozeCount: 0 } : null;
      })(),
    };
    setError(null);
    setOpen(false);
    setTimer(optimisticTimer);
    void queueTimerCommand({
      request: async () => {
        const response = await startTimerAction({
          projectId,
          taskId: taskId === PROJECT_LEVEL ? null : taskId || null,
          note: note.trim() || null,
          reminderMinutes: optimisticTimer.alarm ? optimisticTimer.alarm.durationSeconds / 60 : null,
        });
        if (response.ok) return response.timer;
        if (response.code === "timer_already_active") {
          const current = await loadTimerStateAction();
          if (current.ok && current.timer) return current.timer;
        }
        throw new Error(response.code === "session_expired"
          ? "Your session expired. Sign in again to continue."
          : response.code === "timer_task_required"
            ? "Select or create a saved task before starting."
            : response.code === "timer_denied"
              ? "You no longer have permission to track time here."
              : "The timer could not be started. Check your connection and try again.");
      },
      onSuccess: () => publishTimerSync("timer-started"),
      onFailure: () => {
        if (timerCommandPendingRef.current <= 1) setTimer(previous);
        setOpen(true);
      },
      fallbackError: "The timer could not be started.",
    });
  };

  const openStop = () => {
    setStopNote(timer?.note ?? "");
    setBillable(false);
    setReportingStatus("internal");
    setCompleteTask(false);
    setError(null);
    setStopOpen(true);
  };
  const enableDeviceInactivityDetection = async () => {
    const Constructor = (window as Window & { IdleDetector?: IdleDetectorConstructor }).IdleDetector;
    if (!Constructor) return;
    try {
      const permission = await Constructor.requestPermission();
      setIdlePermission(permission);
      if (permission === "granted") toast.success("Device inactivity detection enabled.");
      else toast.error("Device inactivity permission was not granted. Visible-page detection will remain active.");
    } catch {
      toast.error("Device inactivity permission could not be requested.");
    }
  };
  type QueuedTimerCommand = {
    request(): Promise<TimerView>;
    onSuccess(): void;
    onFailure?(): void;
    fallbackError: string;
  };

  const queueTimerCommand = async ({ request, onSuccess, onFailure, fallbackError }: QueuedTimerCommand) => {
    if (timerCommandPendingRef.current === 0) timerCommandTailRef.current = Promise.resolve(true);
    const commandId = ++timerCommandSequenceRef.current;
    const predecessor = timerCommandTailRef.current;
    timerCommandPendingRef.current += 1;
    setTimerCommandPending(timerCommandPendingRef.current);
    const outcome = predecessor.then(async (predecessorSucceeded) => {
      if (!predecessorSucceeded) throw new Error("A previous timer change did not save.");
      return request();
    });
    timerCommandTailRef.current = outcome.then(() => true, () => false);
    try {
      const canonical = await outcome;
      if (commandId === timerCommandSequenceRef.current) setTimer(canonical);
      onSuccess();
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : fallbackError;
      setError(message);
      onFailure?.();
      toast.error(message);
      if (commandId === timerCommandSequenceRef.current) {
        try {
          const canonical = await loadTimerStateAction();
          if (canonical.ok) {
            setTimer(canonical.timer);
            if (!canonical.timer) closePictureInPicture();
          }
        } catch {
          // Keep the exact local rollback when canonical recovery is unavailable.
        }
      }
      return false;
    } finally {
      timerCommandPendingRef.current = Math.max(0, timerCommandPendingRef.current - 1);
      setTimerCommandPending(timerCommandPendingRef.current);
    }
  };

  const changeTimerState = async () => {
    const previous = timer;
    if (!previous) return false;
    const observedAt = new Date().toISOString();
    const elapsedSeconds = visibleTimerSeconds(previous, new Date(observedAt).getTime());
    const nextState = previous.state === "running" ? "paused" : "running";
    setError(null);
    setTimer({ ...previous, state: nextState, observedAt, elapsedSeconds, pauseReason: nextState === "paused" ? "manual" : null });
    return queueTimerCommand({
      request: async () => {
        const response = previous.state === "running" ? await pauseTimerAction() : await resumeTimerAction();
        if (!response.ok) throw new Error(response.code === "session_expired" ? "Your session expired. Sign in again to continue." : "The timer state could not be changed. Try again.");
        return response.timer;
      },
      onSuccess: () => publishTimerSync("timer-changed"),
      onFailure: () => {
        if (timerCommandPendingRef.current <= 1) setTimer(previous);
      },
      fallbackError: "The timer state could not be changed.",
    });
  };

  const togglePause = () => {
    void changeTimerState();
  };

  const togglePauseFromDetachedWindow = async () => {
    try {
      return await changeTimerState() ? null : "The timer state could not be changed.";
    } catch {
      return "The timer state could not be changed. Check your connection and try again.";
    }
  };

  const publishAlarmNotification = useCallback(async (active: TimerView) => {
    if (!("serviceWorker" in navigator) || !("Notification" in window) || Notification.permission !== "granted") return;
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("Time reminder", {
      body: `${active.taskTitle ?? active.projectName} has reached its tracked-time reminder.`,
      tag: `time-log-timer-alarm-${active.startedAt}`,
      data: { url: window.location.href },
    });
  }, []);

  useEffect(() => {
    if (!timer?.alarm || timer.alarm.status !== "armed" || timer.state !== "running") return;
    const check = async () => {
      if (alarmClaimingRef.current || visibleTimerSeconds(timer, Date.now()) < timer.alarm!.dueAtTrackedSeconds) return;
      alarmClaimingRef.current = true;
      try {
        const response = await claimDueTimerAlarmAction();
        if (response.ok) {
          setTimer(response.timer);
          publishTimerSync("timer-changed");
          if (response.changed) await publishAlarmNotification(response.timer);
        }
      } finally {
        alarmClaimingRef.current = false;
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 1000);
    return () => window.clearInterval(interval);
  }, [publishAlarmNotification, publishTimerSync, timer]);

  const requestAlarmNotifications = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const saveAlarm = async (minutes: number | null) => {
    setAlarmSaving(true);
    try {
      const response = await configureTimerAlarmAction({ minutes });
      if (!response.ok) throw new Error("The reminder could not be saved.");
      setTimer(response.timer); setAlarmOpen(false); publishTimerSync("timer-changed");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "The reminder could not be saved."); }
    finally { setAlarmSaving(false); }
  };

  const dismissAlarm = async () => {
    setAlarmSaving(true);
    try { const response = await dismissTimerAlarmAction(); if (!response.ok) throw new Error("The reminder could not be dismissed."); setTimer(response.timer); publishTimerSync("timer-changed"); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "The reminder could not be dismissed."); }
    finally { setAlarmSaving(false); }
  };

  const snoozeAlarm = async (minutes: 5 | 10 | 15) => {
    setAlarmSaving(true);
    try { const response = await snoozeTimerAlarmAction({ minutes }); if (!response.ok) throw new Error("The reminder could not be snoozed."); setTimer(response.timer); publishTimerSync("timer-changed"); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "The reminder could not be snoozed."); }
    finally { setAlarmSaving(false); }
  };
  const finishTimer = () => {
    const stoppingTimer = timer;
    if (!stoppingTimer || stopSaving) return;
    setError(null);
    setStopSaving(true);
    setTimer(null);
    setStopOpen(false);
    clearInactivityWarning();
    publishTimerSync("timer-stopping");
    startStopping(async () => {
      try {
        const response = await stopTimerAction({
          note: stopNote.trim() || null,
          billable,
          clientReportingStatus: reportingStatus,
          completeTask,
        });
        if (!response.ok) {
          const message =
            response.code === "session_expired"
              ? "Your session expired. Sign in again to continue."
              : response.code === "time_duration_unreasonable"
                ? "This timer is too long to stop automatically. Contact an administrator to recover it."
                : ["task_archived", "project_tasks_read_only", "task_manage_denied", "timer_task_not_found"].includes(response.code)
                  ? "The task can no longer be completed. Uncheck task completion and try stopping again."
                  : "The timer could not be stopped. Try again.";
          setTimer(stoppingTimer);
          setStopOpen(true);
          setError(message);
          publishTimerSync("timer-stop-failed");
          toast.error(message);
          return;
        }
        if (response.taskCompleted && stoppingTimer.taskId) window.dispatchEvent(new CustomEvent(TASK_COMPLETED_EVENT, { detail: { taskId: stoppingTimer.taskId } }));
        publishTimerSync("timer-stopped");
        router.refresh();
      } catch {
        const message = "The timer could not be stopped. Check your connection and try again.";
        setTimer(stoppingTimer);
        setStopOpen(true);
        setError(message);
        publishTimerSync("timer-stop-failed");
        toast.error(message);
      } finally {
        setStopSaving(false);
      }
    });
  };

  const stopFromDetachedWindow = async () => {
    const stoppingTimer = timer;
    if (!stoppingTimer || stopSaving) return "This timer is already being saved.";
    setStopSaving(true);
    setTimer(null);
    clearInactivityWarning();
    publishTimerSync("timer-stopping");
    try {
      const response = await stopTimerAction({
        note: stoppingTimer.note,
        billable: false,
        clientReportingStatus: "internal",
        completeTask: false,
      });
      if (!response.ok) {
        const message = response.code === "session_expired"
          ? "Your session expired. Sign in from Time Log to continue."
          : response.code === "time_duration_unreasonable"
            ? "This timer is too long to stop automatically. Contact an administrator."
            : "The timer could not be stopped. Try again.";
        setTimer(stoppingTimer);
        publishTimerSync("timer-stop-failed");
        toast.error(message);
        return message;
      }
      publishTimerSync("timer-stopped");
      router.refresh();
      return null;
    } catch {
      const message = "The timer could not be stopped. Check your connection and try again.";
      setTimer(stoppingTimer);
      publishTimerSync("timer-stop-failed");
      toast.error(message);
      return message;
    } finally {
      setStopSaving(false);
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
      const DetachedBroadcastChannel = (
        detached as Window & { BroadcastChannel?: typeof BroadcastChannel }
      ).BroadcastChannel;
      const detachedChannel = DetachedBroadcastChannel
        ? new DetachedBroadcastChannel(TIMER_CHANNEL)
        : null;
      const closeOnStopped = (message: TimerSyncMessage) => {
        if ((message.type === "timer-stopping" || message.type === "timer-stopped") && !detached.closed)
          detached.close();
      };
      const onDetachedMessage = (event: MessageEvent<TimerSyncMessage>) => {
        if (event.data?.type) closeOnStopped(event.data);
      };
      const onDetachedStorage = (event: StorageEvent) => {
        if (event.key !== TIMER_SYNC_STORAGE_KEY || !event.newValue) return;
        try {
          closeOnStopped(JSON.parse(event.newValue) as TimerSyncMessage);
        } catch {
          // The opener still reconciles state with the server.
        }
      };
      let detachedSyncCleaned = false;
      const cleanupDetachedSync = () => {
        if (detachedSyncCleaned) return;
        detachedSyncCleaned = true;
        detachedChannel?.removeEventListener("message", onDetachedMessage);
        detachedChannel?.close();
        detached.removeEventListener("storage", onDetachedStorage);
      };
      detachedChannel?.addEventListener("message", onDetachedMessage);
      detached.addEventListener("storage", onDetachedStorage);
      pipSyncCleanupRef.current();
      pipSyncCleanupRef.current = cleanupDetachedSync;
      pipWindowRef.current = detached;
      detached.addEventListener(
        "pagehide",
        () => {
          cleanupDetachedSync();
          if (pipWindowRef.current === detached) {
            pipWindowRef.current = null;
            pipSyncCleanupRef.current = () => undefined;
            setPipWindow(null);
          }
        },
        { once: true },
      );
      setPipWindow(detached);
    } catch {
      toast.error(
        "The always-on-top timer could not be opened. Check your browser's Picture-in-Picture permissions.",
      );
    }
  };

  if (!timer && !canTrack) return null;
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
              <Button
                size="icon"
                variant={timer.alarm?.status === "due" ? "default" : "ghost"}
                aria-label="Timer reminder"
                title="Timer reminder"
                onClick={() => setAlarmOpen(true)}
              >
                <BellRing />
              </Button>
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
              {timer.state === "running" && idleSupported && idlePermission !== "granted" && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Enable device inactivity detection"
                  title="Enable device inactivity detection"
                  onClick={() => void enableDeviceInactivityDetection()}
                >
                  <Activity />
                </Button>
              )}
              {syncIssue === "session" ? (
                <Badge variant="destructive" asChild>
                  <Link href="/login">Sign in</Link>
                </Badge>
              ) : syncIssue === "network" ? (
                <Badge variant="outline">Offline</Badge>
              ) : (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={timer.state === "running" ? "Pause timer" : "Resume timer"}
                    title={timer.state === "running" ? "Pause timer" : "Resume timer"}
                    onClick={togglePause}
                  >
                    {timer.state === "running" ? <Pause /> : <Play />}
                  </Button>
                  <Button size="sm" variant="outline" disabled={changingState} onClick={openStop}>
                    <Square />
                    Stop
                  </Button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              {savingTimer ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Clock3 className="size-4 text-muted-foreground" />}
              <span>
                {savingTimer
                  ? "Saving time…"
                  : syncIssue === "network"
                  ? "Timer status offline"
                  : "No timer running"}
              </span>
            </div>
            {savingTimer ? (
              <Badge variant="secondary">Please wait</Badge>
            ) : syncIssue === "session" ? (
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
              <div className="space-y-2">
                <Label>Tracked-time reminder</Label>
                <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No reminder</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {reminderMinutes === "custom" && <Input type="number" min={1} max={480} value={customReminderMinutes} onChange={(event) => setCustomReminderMinutes(event.target.value)} aria-label="Custom reminder minutes" />}
                <p className="text-xs text-muted-foreground">Counts active tracked time only. The browser must remain open.</p>
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
      <Dialog open={alarmOpen} onOpenChange={(next) => !alarmSaving && setAlarmOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Timer reminder</DialogTitle>
            <DialogDescription>Reminders count active tracked time only. Paused time does not count, and the browser must remain open.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[15, 30, 45, 60].map((minutes) => <Button key={minutes} variant="outline" disabled={alarmSaving} onClick={() => void saveAlarm(minutes)}>{minutes} min</Button>)}
          </div>
          <div className="flex gap-2">
            <Input type="number" min={1} max={480} value={customReminderMinutes} onChange={(event) => setCustomReminderMinutes(event.target.value)} aria-label="Custom timer reminder minutes" />
            <Button disabled={alarmSaving || Number(customReminderMinutes) < 1 || Number(customReminderMinutes) > 480} onClick={() => void saveAlarm(Number(customReminderMinutes))}>Set</Button>
          </div>
          {notificationPermission !== "granted" && notificationPermission !== "unsupported" && <Button variant="outline" disabled={alarmSaving || notificationPermission === "denied"} onClick={() => void requestAlarmNotifications()}><BellRing />{notificationPermission === "denied" ? "Notifications blocked" : "Enable browser notifications"}</Button>}
          {timer?.alarm && <Button variant="ghost" disabled={alarmSaving} onClick={() => void saveAlarm(null)}>Remove reminder</Button>}
        </DialogContent>
      </Dialog>
      <Dialog open={timer?.alarm?.status === "due"} onOpenChange={() => undefined}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Tracked-time reminder</DialogTitle>
            <DialogDescription>{timer?.taskTitle ?? timer?.projectName ?? "Your timer"} has reached its reminder. Dismissing this alarm will not stop the timer.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-4"><p className="text-sm font-medium">Timer is still running</p><p className="mt-1 text-sm text-muted-foreground">Snooze adds more active tracked time.</p></div>
          <DialogFooter>
            <Button variant="outline" disabled={alarmSaving} onClick={() => void snoozeAlarm(5)}>Snooze 5 min</Button>
            <Button variant="outline" disabled={alarmSaving} onClick={() => void snoozeAlarm(10)}>10 min</Button>
            <Button variant="outline" disabled={alarmSaving} onClick={() => void snoozeAlarm(15)}>15 min</Button>
            <Button disabled={alarmSaving} onClick={() => void dismissAlarm()}>{alarmSaving && <Loader2 className="animate-spin" />}Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(inactivityWarning && timer?.state === "running")} onOpenChange={() => undefined}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Are you still working?</DialogTitle>
            <DialogDescription>
              No meaningful activity has been detected for more than two minutes. Confirm within {inactivityCountdown} seconds or this timer will pause from the moment inactivity was detected.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Automatic pause in</p>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums" aria-live="polite">
              00:{String(inactivityCountdown).padStart(2, "0")}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={autoPausing}
              onClick={() => {
                clearInactivityWarning();
                togglePause();
              }}
            >
              <Pause />
              Pause now
            </Button>
            <Button disabled={autoPausing} onClick={confirmStillWorking}>
              {autoPausing ? <Loader2 className="animate-spin" /> : <Activity />}
              I’m still working
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={inactivityRecoveryOpen && timer?.state === "paused" && timer.pauseReason === "inactivity"} onOpenChange={setInactivityRecoveryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Timer paused after inactivity</DialogTitle>
            <DialogDescription>
              Time after the inactivity threshold was not recorded. Resume the same timer, keep it paused, or stop and save the work recorded so far.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInactivityRecoveryOpen(false)}>
              Keep paused
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setInactivityRecoveryOpen(false);
                openStop();
              }}
            >
              <Square />
              Stop timer
            </Button>
            <Button
              disabled={changingState}
              onClick={() => {
                setInactivityRecoveryOpen(false);
                togglePause();
              }}
            >
              {changingState ? <Loader2 className="animate-spin" /> : <Play />}
              Resume timer
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
          <DetachedTimer
            timer={timer}
            onStop={stopFromDetachedWindow}
            onTogglePause={togglePauseFromDetachedWindow}
            inactivityCountdown={inactivityWarning ? inactivityCountdown : null}
            onStillWorking={confirmStillWorking}
          />,
          pipWindow.document.body,
        )}
    </>
  );
}

export function requestTimerStart(prefill: TimerPrefill = {}) {
  window.dispatchEvent(new CustomEvent(START_TIMER_EVENT, { detail: prefill }));
}
