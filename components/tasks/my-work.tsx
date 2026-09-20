import Link from "next/link";
import { CalendarClock, FolderKanban } from "lucide-react";
import { TimerStartButton } from "@/components/time/timer-start-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MyWorkGroups, MyWorkTask } from "@/domain/tasks/my-work";

const sections: Array<{ key: keyof MyWorkGroups; title: string; description: string }> = [
  { key: "overdue", title: "Overdue", description: "Past their due date and still unfinished." },
  { key: "today", title: "Today", description: "Due today in your configured timezone." },
  { key: "upcoming", title: "Upcoming", description: "Scheduled after today." },
  { key: "noDueDate", title: "No due date", description: "Assigned work without a deadline." },
];

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function dueLabel(task: MyWorkTask, timezone: string) {
  if (task.dueTimeSet && task.dueAt) return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: timezone, timeZoneName: "short" }).format(new Date(task.dueAt));
  return task.dueDate ? formatDateOnly(task.dueDate) : null;
}

function WorkRow({ task, timezone }: { task: MyWorkTask; timezone: string }) {
  const due = dueLabel(task, timezone);
  return <div className="rounded-lg border bg-card p-4" id={`task-${task.id}`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><Link className="font-medium hover:underline" href={`/projects/${task.project.id}/todos#task-${task.id}`}>{task.title}</Link><Badge variant="outline" className="capitalize">{task.status.replace("_", " ")}</Badge><Badge variant="secondary" className="capitalize">{task.priority}</Badge></div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><Link className="inline-flex items-center gap-1 hover:text-foreground" href={`/projects/${task.project.id}`}><FolderKanban className="size-4" />{task.project.name} ({task.project.key})</Link>{due && <span className="inline-flex items-center gap-1"><CalendarClock className="size-4" />Due {due}</span>}</div>
      </div>
      {task.project.timeEnabled && <TimerStartButton projectId={task.project.id} taskId={task.id} />}
    </div>
  </div>;
}

export function MyWork({ groups, timezone }: { groups: MyWorkGroups; timezone: string }) {
  const count = Object.values(groups).reduce((total, tasks) => total + tasks.length, 0);
  if (count === 0) return <Card><CardHeader><CardTitle>No assigned work</CardTitle><CardDescription>You have no unfinished tasks assigned across your active projects.</CardDescription></CardHeader><CardContent><Button asChild><Link href="/projects">Browse projects</Link></Button></CardContent></Card>;
  return <div className="space-y-8">{sections.map((section) => {
    const tasks = groups[section.key];
    if (tasks.length === 0) return null;
    return <section key={section.key} aria-labelledby={`my-work-${section.key}`} className="space-y-3"><div><h2 id={`my-work-${section.key}`} className="text-base font-semibold">{section.title} <span className="text-muted-foreground">({tasks.length})</span></h2><p className="text-sm text-muted-foreground">{section.description}</p></div><div className="space-y-3">{tasks.map((task) => <WorkRow key={`${task.project.id}-${task.id}`} task={task} timezone={timezone} />)}</div></section>;
  })}</div>;
}
