"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Activity, CheckCircle2, Clock3, Coffee, ListTodo, Settings2, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { loadWorkDashboardAction, updateWorkTargetAction } from "@/app/(app)/dashboard-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardPeriod, loadWorkDashboard } from "@/domain/work-dashboard/service";

type DashboardData = NonNullable<Awaited<ReturnType<typeof loadWorkDashboard>>>;
const periods: Array<{ value: DashboardPeriod; label: string }> = [{ value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "This month" }];
const weekdays = [{ value: "mon", label: "M" }, { value: "tue", label: "T" }, { value: "wed", label: "W" }, { value: "thu", label: "T" }, { value: "fri", label: "F" }, { value: "sat", label: "S" }, { value: "sun", label: "S" }] as const;

function duration(value: number) {
  const hours = Math.floor(value / 3600); const minutes = Math.floor((value % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function liveSeconds(data: DashboardData, now: number) {
  if (!data.activeTimer || data.activeTimer.state !== "running") return data.trackedSeconds;
  return data.trackedSeconds + Math.max(0, Math.floor((now - Date.parse(data.activeTimer.observedAt)) / 1000));
}

export function WorkDashboard({ initial }: { initial: DashboardData }) {
  const [data, setData] = useState(initial); const [period, setPeriod] = useState<DashboardPeriod>(initial.period); const [now, setNow] = useState(() => Date.now()); const [pending, startTransition] = useTransition();
  const [targetOpen, setTargetOpen] = useState(false); const [targetHours, setTargetHours] = useState(String(initial.target.dailyTargetMinutes / 60)); const [workingDays, setWorkingDays] = useState<string[]>(initial.target.workingDays);
  const refresh = useCallback((nextPeriod: DashboardPeriod, quiet = false) => startTransition(async () => { const result = await loadWorkDashboardAction(nextPeriod); if (result.ok) setData(result.dashboard); else if (!quiet) toast.error("Dashboard data could not be refreshed."); }), []);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("time-log-active-timer");
    const update = () => refresh(period, true); channel?.addEventListener("message", update); window.addEventListener("focus", update);
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") update(); }, 15_000);
    return () => { channel?.removeEventListener("message", update); channel?.close(); window.removeEventListener("focus", update); window.clearInterval(poll); };
  }, [period, refresh]);

  const tracked = liveSeconds(data, now); const progress = data.target.periodTargetSeconds ? Math.min(100, tracked / data.target.periodTargetSeconds * 100) : 0;
  const formatTime = useMemo(() => new Intl.DateTimeFormat("en-US", { timeZone: data.timezone, hour: "numeric", minute: "2-digit" }), [data.timezone]);
  const changePeriod = (value: string) => { const next = value as DashboardPeriod; setPeriod(next); refresh(next); };
  const saveTarget = () => {
    const dailyTargetMinutes = Math.round(Number(targetHours) * 60);
    if (!Number.isFinite(dailyTargetMinutes) || dailyTargetMinutes < 30 || dailyTargetMinutes > 1440 || !workingDays.length) { toast.error("Choose 0.5–24 hours and at least one working day."); return; }
    startTransition(async () => { const result = await updateWorkTargetAction({ dailyTargetMinutes, workingDays }); if (!result.ok) { toast.error("Work target could not be saved."); return; } setTargetOpen(false); toast.success("Work target updated."); refresh(period, true); });
  };
  const summaries = [
    { label: "Tracked time", value: duration(tracked), icon: Clock3 },
    { label: "Completed", value: String(data.completedTasks), icon: CheckCircle2 },
    { label: "In progress", value: String(data.inProgressTasks), icon: ListTodo },
    { label: "Work sessions", value: String(data.sessionCount), icon: TimerReset },
    { label: "Inactive time", value: duration(data.inactiveSeconds), icon: Coffee },
  ];

  return <section className="space-y-4" aria-busy={pending}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs value={period} onValueChange={changePeriod}><TabsList>{periods.map((item) => <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>)}</TabsList></Tabs>
      <Dialog open={targetOpen} onOpenChange={setTargetOpen}><DialogTrigger asChild><Button variant="outline" size="sm"><Settings2 /> Work target</Button></DialogTrigger><DialogContent>
        <DialogHeader><DialogTitle>Personal work target</DialogTitle><DialogDescription>Set your daily target and working days. Weekly and monthly goals are calculated from this schedule.</DialogDescription></DialogHeader>
        <label className="grid gap-2 text-sm font-medium">Daily target (hours)<Input type="number" min="0.5" max="24" step="0.5" value={targetHours} onChange={(event) => setTargetHours(event.target.value)} /></label>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Working days</legend><div className="flex flex-wrap gap-3">{weekdays.map((day, index) => <label key={day.value} className="flex items-center gap-1.5 text-xs font-medium"><Checkbox checked={workingDays.includes(day.value)} onCheckedChange={(checked) => setWorkingDays(checked ? [...workingDays, day.value] : workingDays.filter((value) => value !== day.value))} /><span aria-label={["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][index]}>{day.label}</span></label>)}</div></fieldset>
        <DialogFooter><Button variant="outline" onClick={() => setTargetOpen(false)}>Cancel</Button><Button onClick={saveTarget} disabled={pending}>Save target</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{summaries.map(({ label, value, icon: Icon }) => <Card key={label} size="sm"><CardContent className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div><Icon className="size-5 text-primary" /></CardContent></Card>)}</div>

    <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
      <Card><CardHeader><CardTitle>Current focus</CardTitle><CardDescription>Your live timer and progress toward this period’s target.</CardDescription></CardHeader><CardContent className="space-y-5">
        {data.activeTimer ? <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4"><span className={`mt-1 size-2.5 rounded-full ${data.activeTimer.state === "running" ? "bg-emerald-500" : "bg-amber-500"}`} /><div className="min-w-0"><p className="truncate font-medium">{data.activeTimer.taskTitle}</p><p className="text-sm text-muted-foreground">{data.activeTimer.projectName} · {data.activeTimer.state}</p><p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{duration(data.activeTimer.elapsedSeconds + (data.activeTimer.state === "running" ? Math.max(0, Math.floor((now - Date.parse(data.activeTimer.observedAt)) / 1000)) : 0))}</p></div></div> : <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">No timer is currently active.</div>}
        <div><div className="mb-2 flex justify-between text-sm"><span>Target progress</span><span className="font-medium tabular-nums">{Math.round(progress)}%</span></div><Progress value={progress} /><p className="mt-2 text-xs text-muted-foreground">{duration(tracked)} of {duration(data.target.periodTargetSeconds)}</p></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Recent time logs</CardTitle><CardDescription>Your latest entries in this period.</CardDescription></CardHeader><CardContent>{data.recentLogs.length ? <div className="divide-y">{data.recentLogs.map((log) => <div key={`${log.id}-${log.projectName}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate font-medium">{log.taskTitle}</p><p className="truncate text-xs text-muted-foreground">{log.projectName} · {formatTime.format(new Date(log.startedAt))} · {log.source}</p></div><span className="shrink-0 text-sm font-medium tabular-nums">{duration(log.durationSeconds)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No time logged in this period.</p>}</CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Activity timeline</CardTitle><CardDescription>Recorded work segments; pauses appear as gaps rather than worked time.</CardDescription></CardHeader><CardContent>{data.timeline.length ? <div className="space-y-3 border-l pl-4">{data.timeline.slice(-12).map((item) => <div key={item.id} className="relative"><span className="absolute top-1.5 -left-[1.2rem] size-2 rounded-full bg-primary" /><p className="font-medium">{item.taskTitle}</p><p className="text-xs text-muted-foreground">{formatTime.format(new Date(item.startedAt))}–{formatTime.format(new Date(item.endedAt))} · {item.projectName}</p></div>)}</div> : <div className="flex items-center gap-2 text-sm text-muted-foreground"><Activity className="size-4" />No timer activity in this period.</div>}</CardContent></Card>
  </section>;
}
