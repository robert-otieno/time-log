1) Product & UX (single screen + right sheets)
Unify to one dashboard and reveal details in right-side sheets (you already have TaskEditSheet/TaskDetailsSheet—lean into them).
Layout skeleton (sticky header + 2-column with right rail):

Key UX upgrades

- Command palette (cmd/ctrl+k) for “New task / habit / priority / goal”, “Jump to date”.
- Keyboard shortcuts: n add task, d set due today, g go to goals, p priorities.
- Smart quick-add parser: Write brief @GBDCEI #priority:high ^2025-08-15 !09:00.
- Task grouping: by tag/project then priority; compact rows; virtualized list for long days.
- Streaks & momentum: small streak badges in HabitTracker, “On pace” meter for goals.
- Inline editing: title, due, tag, priority without opening sheets.
- Focus mode: hide sidebars, show only Today list + next habits (toggle f).

2) Data model & scalability

You’re on Drizzle + better-sqlite3. For Vercel hosting & scale, move to PostgreSQL (Neon/Supabase/Vercel Postgres) while keeping Drizzle.

Add these columns/indexes

tasks (user_id, date, tag, priority, done, due_at) ⇒ indexes:

idx_tasks_user_date (user_id, date)

idx_tasks_user_done_due (user_id, done, due_at)

habit_completions (habit_id, day) ⇒ UNIQUE (habit_id, day) (you did this), add idx_hc_user_day (user_id, day)

weekly_priorities (user_id, week_start) ⇒ idx_wp_user_week

goals (user_id, status) ⇒ idx_goals_user_status

Progress calc
Materialize weekly priority progress to avoid repeated aggregation:

Table priority_progress (priority_id, pct, updated_at); recompute via cron or triggers, or compute incrementally on task toggle (server action).

Multi-tenant & future teams

Add org_id & project_id to tasks, habits, goals, priorities.

Soft deletes (deleted_at) for undo & auditing.

Migration path (SQLite → Postgres)

Stand up Neon/Supabase; switch Drizzle connection to Postgres (HTTP driver if using Edge).

Create schemas with Drizzle migrations.

Write a one-off script to read from SQLite and insert into Postgres in batches (idempotent).

Dual-write for a day (optional), then cut over.

Kill SQLite writes, archive file.

3) Performance & runtime

Edge routes for read-heavy endpoints using Neon HTTP + Drizzle; keep mutations in Node runtime if you need server-side libraries.

React cache + Suspense for useTasks(date), useGoals().

Optimistic updates in client; reconcile on action response.

Client bundles: code-split sheets (dynamic(() => import(...), { ssr: false })).

Virtualization (e.g., @tanstack/react-virtual) for large task lists.

4) Habits & goals—make them feel “alive”

Flexible habit types: boolean, count, minutes, pomodoros.

Schedules: per-weekday mask (e.g., "MTWTF--") or RRULE; calculate “due today” habits.

Auto-nudges: when a habit has 0/target by 5pm, surface “Finish 2 more”.

Goal alignment: require each priority to map to a goal (optional), show “% of goal complete”.

Habit grid example
```
// 7-day grid; filled dots = done, pulse if still due today
<ol className="grid grid-cols-7 gap-1">
  {days.map(d => (
    <li key={d.toISOString()}>
      <button className={cn(
        "h-6 w-6 rounded-full border",
        isDone(d) ? "bg-primary" : "bg-background",
        isToday(d) && !isDone(d) && "animate-pulse border-primary"
      )} />
    </li>
  ))}
</ol>
```
5) Integrations & workflow automation

Calendar: one-way push due tasks to Google Calendar (ics or API); pull busy times to avoid over-scheduling.

Notifications: web push (VAPID) or email digests (Resend) for reminders + daily plan at 8am.

Attachments: upload to S3/Supabase Storage; store file refs as JSON.

Import/export: CSV & JSON; quick wins for switching tools.

6) Reliability, security, privacy

Auth: NextAuth/Auth.js (or Supabase Auth). Always scope DB queries by user_id.

Row Level Security (if Supabase): write policies per table.

Background jobs: Vercel Cron for: carry-over unfinished tasks, recompute progress, send digests.

Rate limit mutations (simple token bucket by user).

7) Analytics & insights (useful, not noisy)

Daily review: tasks completed, time on habits, priorities progress, goal deltas.

Heatmaps: completion by weekday/hour.

Rollups: materialized views for “last 7 days” to keep reads cheap.

Example: weekly completion

-- Postgres materialized view
CREATE MATERIALIZED VIEW mv_weekly_summary AS
SELECT user_id,
       date_trunc('week', date) AS week,
       count(*) FILTER (WHERE done) AS completed,
       count(*) AS total
FROM daily_tasks
GROUP BY user_id, date_trunc('week', date);

CREATE INDEX ON mv_weekly_summary (user_id, week);

8) Developer experience & quality

Schema validation with zod on all server actions; return typed errors.

Component tests (Vitest + React Testing Library) for TaskItem, HabitTracker, sheets.

E2E (Playwright): add/edit/delete flows; keyboard shortcuts.

Error reporting: Sentry; logs: Vercel OG + pino.

Preview DB branches: link PR previews to a temp Neon branch; seed with fixtures.

9) Concrete enhancements you can ship this week

Command palette (cmd+k) with quick-add parser.

Inline edit for title/priority/tag/due (no sheet).

Habit types & streaks (boolean/count/time).

Optimistic toggles for tasks/subtasks/habits (snappy).

Right-rail Goals & Priorities with small progress bars + add row.

Switch to Postgres (Neon) + Drizzle using HTTP driver; keep API stable.

Daily email at 7:30am: tasks due, habits scheduled, priorities status.

Keyboard shortcuts & focus mode.

Snippets you can copy

Command palette skeleton
```
// components/command-menu.tsx
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
export function CommandMenu({ open, setOpen }) {
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandGroup heading="Create">
          <CommandItem onSelect={() => openTaskQuickAdd()}>New task</CommandItem>
          <CommandItem onSelect={() => openHabitQuickAdd()}>New habit</CommandItem>
          <CommandItem onSelect={() => openPriorityQuickAdd()}>New priority</CommandItem>
          <CommandItem onSelect={() => openGoalQuickAdd()}>New goal</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => goToday()}>Go to Today</CommandItem>
          <CommandItem onSelect={() => goWeek()}>Go to this Week</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

Optimistic toggle (server action)

const toggle = async (id: string, done: boolean) => {
  startTransition(() => {
    setLocal((prev) => prev.map(t => t.id === id ? { ...t, done: !done } : t));
  });
  try {
    await toggleDailyTask(id, done); // server action
  } catch {
    setLocal((prev) => prev.map(t => t.id === id ? { ...t, done } : t)); // rollback
    toast.error("Couldn’t update task");
  }
};


Drizzle (Postgres HTTP) client

// db/index.ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!); // HTTP driver for Edge
export const db = drizzle(sql, { schema });

TL;DR recommendation

One-screen dashboard with right-side sheets (you’re close).

Postgres (Neon/Supabase) + Drizzle for scale and Vercel friendliness.

Add command palette, inline edits, streaks, optimized queries/materialized views, optimistic UX.

Ship notifications, calendar sync, and import/export next.

Level up quality with zod validation, tests, Sentry, preview DB branches.