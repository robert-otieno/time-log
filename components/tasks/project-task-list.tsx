"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  CornerDownRight,
  ListPlus,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  archiveTaskAction,
  changeTaskStatusAction,
  createTaskAction,
  restoreTaskAction,
  updateTaskAction,
} from "@/app/(app)/projects/[projectId]/todos/actions";
import { StatusBadge, priorityTone, statusTone } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Dialog,
  DialogClose,
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
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { VisibilityControl } from "@/components/visibility/visibility-control";
import type { TaskListItem } from "@/domain/tasks/form-data";
import type { TaskAssigneeOption } from "@/domain/tasks/read";
import type { Visibility } from "@/domain/visibility/schemas";
import { requireActionSuccess, useOptimisticMutations } from "@/hooks/use-optimistic-mutations";

type Draft = {
  title: string;
  description: string;
  assigneeIds: string[];
  priority: TaskListItem["priority"];
  dueDate: string;
  dueTime: string;
  dueTimeSet: boolean;
  visibility: Visibility;
  parentTaskId: string;
};
type ViewTask = TaskListItem & { saving?: boolean };

const blank = (parentTaskId = "none"): Draft => ({
  title: "",
  description: "",
  assigneeIds: [],
  priority: "medium",
  dueDate: "",
  dueTime: "09:00",
  dueTimeSet: false,
  visibility: "internal",
  parentTaskId,
});

const TASK_COMPLETED_EVENT = "time-log:task-completed";

function localParts(dueDate: string | null, dueAt: string | null) {
  if (!dueAt) return { dueDate: dueDate ?? "", dueTime: "09:00" };
  const date = new Date(dueAt);
  return {
    dueDate:
      dueDate ??
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    dueTime: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
}

function dueIso(draft: Draft) {
  if (!draft.dueDate || !draft.dueTimeSet) return null;
  const [year, month, day] = draft.dueDate.split("-").map(Number);
  const [hour, minute] = draft.dueTime.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

const command = (draft: Draft, sortOrder: number) => ({
  title: draft.title,
  description: draft.description.trim() || null,
  assigneeIds: draft.assigneeIds,
  priority: draft.priority,
  dueDate: draft.dueDate || null,
  dueAt: dueIso(draft),
  dueTimeSet: draft.dueDate ? draft.dueTimeSet : false,
  visibility: draft.visibility,
  parentTaskId: draft.parentTaskId === "none" ? null : draft.parentTaskId,
  boardColumnId: null,
  sortOrder,
});

function optimisticTask(id: string, draft: Draft, sortOrder: number): ViewTask {
  return {
    id,
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    assigneeIds: draft.assigneeIds,
    status: "todo",
    priority: draft.priority,
    dueDate: draft.dueDate || null,
    dueAt: dueIso(draft),
    dueTimeSet: draft.dueDate ? draft.dueTimeSet : false,
    visibility: draft.visibility,
    parentTaskId: draft.parentTaskId === "none" ? null : draft.parentTaskId,
    sortOrder,
    archivedAt: null,
    saving: true,
  };
}

export function ProjectTaskList({
  projectId,
  initialTasks,
  assignees,
  readOnly,
  clientView,
}: {
  projectId: string;
  initialTasks: TaskListItem[];
  assignees: TaskAssigneeOption[];
  readOnly: boolean;
  clientView: boolean;
}) {
  const mutations = useOptimisticMutations();
  const [tasks, setTasks] = useState<ViewTask[]>(initialTasks);
  const [draft, setDraft] = useState(blank);
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null);
  const [subtaskDraft, setSubtaskDraft] = useState(blank);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");

  useEffect(() => {
    const onCompleted = (event: Event) => {
      const taskId = (event as CustomEvent<{ taskId?: string }>).detail?.taskId;
      if (taskId) setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status: "done" } : task));
    };
    window.addEventListener(TASK_COMPLETED_EVENT, onCompleted);
    return () => window.removeEventListener(TASK_COMPLETED_EVENT, onCompleted);
  }, []);

  const filteredTasks = useMemo(() => tasks.filter((task) =>
    (statusFilter === "all" || task.status === statusFilter) &&
    (priorityFilter === "all" || task.priority === priorityFilter) &&
    (assigneeFilter === "all" || task.assigneeIds.includes(assigneeFilter)) &&
    (visibilityFilter === "all" || task.visibility === visibilityFilter)
  ), [tasks, statusFilter, priorityFilter, assigneeFilter, visibilityFilter]);
  const activeTasks = useMemo(
    () => filteredTasks.filter((task) => !task.archivedAt && task.status !== "done"),
    [filteredTasks],
  );
  const completedTasks = useMemo(
    () => filteredTasks.filter((task) => !task.archivedAt && task.status === "done"),
    [filteredTasks],
  );
  const archivedTasks = useMemo(
    () => filteredTasks.filter((task) => Boolean(task.archivedAt)),
    [filteredTasks],
  );

  const create = (values: Draft, reset: () => void) => {
    if (!values.title.trim()) return;
    const optimisticId = `pending-${crypto.randomUUID()}`;
    const sortOrder = tasks.length;
    setError(null);
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    setVisibilityFilter("all");
    reset();
    void mutations.run({
      scope: `task:${optimisticId}`,
      operation: "create",
      snapshot: () => null,
      optimistic: () => setTasks((current) => [...current, optimisticTask(optimisticId, values, sortOrder)]),
      request: async () => requireActionSuccess(await createTaskAction(projectId, command(values, sortOrder))),
      reconcile: (result) => setTasks((current) => current.map((task) => task.id === optimisticId ? { ...task, id: result.id, saving: false } : task)),
      rollback: () => setTasks((current) => current.filter((task) => task.id !== optimisticId)),
      errorMessage: (cause) => cause instanceof Error ? cause.message : "The task could not be created.",
      onError: setError,
      retry: (cause) => cause instanceof Error && cause.message.includes("Try again"),
    });
  };

  const mutateStatus = (task: ViewTask) => {
    const next = task.status === "done" ? "todo" : "done";
    setError(null);
    void mutations.run({
      scope: `task:${task.id}`,
      operation: "status",
      snapshot: () => task.status,
      optimistic: () => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: next } : item)),
      request: async () => requireActionSuccess(await changeTaskStatusAction(projectId, task.id, next)),
      reconcile: () => undefined,
      rollback: (previousStatus) => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: previousStatus } : item)),
      errorMessage: (cause) => cause instanceof Error ? cause.message : "The task status could not be updated.",
      onError: setError,
      retry: (cause) => cause instanceof Error && cause.message.includes("Try again"),
    });
  };

  const openSubtask = (taskId: string) => {
    setSubtaskParentId(taskId);
    setSubtaskDraft(blank(taskId));
    setExpanded(null);
  };
  const restore = (taskId: string) => {
    const previous = tasks.find((task) => task.id === taskId)?.archivedAt ?? null;
    void mutations.run({
      scope: `task:${taskId}`,
      operation: "restore",
      snapshot: () => previous,
      optimistic: () => setTasks((current) => current.map((item) => item.id === taskId ? { ...item, archivedAt: null } : item)),
      request: async () => requireActionSuccess(await restoreTaskAction(projectId, taskId)),
      reconcile: () => undefined,
      rollback: (archivedAt) => setTasks((current) => current.map((item) => item.id === taskId ? { ...item, archivedAt } : item)),
      errorMessage: (cause) => cause instanceof Error ? cause.message : "The task could not be restored.",
      onError: setError,
      retry: (cause) => cause instanceof Error && cause.message.includes("Try again"),
    });
  };

  const saveTask = (task: ViewTask, values: Draft) => {
    const updated = command(values, task.sortOrder);
    return mutations.run({
      scope: `task:${task.id}`,
      operation: "edit",
      snapshot: () => task,
      optimistic: () => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...updated } : item)),
      request: async () => requireActionSuccess(await updateTaskAction(projectId, { taskId: task.id, ...updated })),
      reconcile: () => undefined,
      rollback: (previous) => setTasks((current) => current.map((item) => item.id === task.id ? previous : item)),
      errorMessage: (cause) => cause instanceof Error ? cause.message : "The task could not be updated.",
      onError: setError,
      retry: false,
    });
  };

  const archive = (taskId: string) => {
    const previous = tasks.find((task) => task.id === taskId);
    if (!previous) return;
    void mutations.run({
      scope: `task:${taskId}`,
      operation: "archive",
      snapshot: () => previous,
      optimistic: () => {
        setArchiveId(null);
        setTasks((current) => current.map((task) => task.id === taskId ? { ...task, archivedAt: new Date().toISOString() } : task));
      },
      request: async () => requireActionSuccess(await archiveTaskAction(projectId, taskId)),
      reconcile: () => undefined,
      rollback: (snapshot) => {
        setTasks((current) => current.map((task) => task.id === taskId ? snapshot : task));
        setArchiveId(taskId);
      },
      errorMessage: (cause) => cause instanceof Error ? cause.message : "The task could not be archived.",
      onError: setError,
      retry: (cause) => cause instanceof Error && cause.message.includes("Try again"),
    });
  };

  const orderTasks = (items: ViewTask[]) => {
    const ordered: { task: ViewTask; depth: number }[] = [];
    const top = items.filter((task) => !task.parentTaskId || !items.some((parent) => parent.id === task.parentTaskId));
    const appendTask = (task: ViewTask, depth = 0) => {
      ordered.push({ task, depth });
      items.filter((candidate) => candidate.parentTaskId === task.id).forEach((child) => appendTask(child, depth + 1));
    };
    top.forEach((task) => appendTask(task));
    return ordered;
  };

  const renderTask = (task: ViewTask, depth: number, archived: boolean): ReactNode => (
    <div key={task.id} className="border-b last:border-b-0">
      <TaskRow
          task={task}
          depth={depth}
          assignees={assignees}
          allTasks={tasks.filter((candidate) => !candidate.archivedAt)}
          readOnly={readOnly}
          archived={archived}
          expanded={expanded === task.id}
          pending={mutations.isPending(`task:${task.id}`)}
          statusPending={mutations.isPending(`task:${task.id}`)}
          onToggle={() => mutateStatus(task)}
          onExpand={() => setExpanded(expanded === task.id ? null : task.id)}
          onAddSubtask={() => openSubtask(task.id)}
          onSave={(values) => saveTask(task, values)}
          onArchive={() => setArchiveId(task.id)}
          onRestore={() => restore(task.id)}
      />
      {subtaskParentId === task.id && !archived && (
        <InlineSubtask
            draft={subtaskDraft}
            setDraft={setSubtaskDraft}
            assignees={assignees}
            tasks={tasks.filter((candidate) => !candidate.archivedAt)}
            pending={false}
            onCancel={() => setSubtaskParentId(null)}
            onCreate={() =>
              create(subtaskDraft, () => {
                setSubtaskParentId(null);
                setSubtaskDraft(blank());
              })
            }
        />
      )}
    </div>
  );

  const renderList = (items: ViewTask[], archived: boolean, empty: string) => {
    const ordered = orderTasks(items);
    return ordered.length === 0 ? (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">{empty}</div>
    ) : (
      <div className="overflow-hidden rounded-lg border bg-card">
        {ordered.map(({ task, depth }) => renderTask(task, depth, archived))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {!readOnly && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex gap-2">
            <Input
              aria-label="Task title"
              placeholder="What needs to be done?"
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              onKeyDown={(event) =>
                event.key === "Enter" && create(draft, () => setDraft(blank()))
              }
            />
            <Button
              disabled={!draft.title.trim()}
              onClick={() => create(draft, () => setDraft(blank()))}
            >
              <Plus />
              Create task
            </Button>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Add details
            </summary>
            <TaskFields
              idPrefix="new-task"
              draft={draft}
              setDraft={setDraft}
              assignees={assignees}
              tasks={tasks.filter((task) => !task.archivedAt)}
            />
          </details>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Filter
          value={statusFilter}
          onChange={setStatusFilter}
          label="Status"
          values={["backlog", "todo", "in_progress", "blocked", "done"]}
        />
        <Filter
          value={priorityFilter}
          onChange={setPriorityFilter}
          label="Priority"
          values={["low", "medium", "high", "urgent"]}
        />
        {!clientView && (
          <Filter
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            label="Assignee"
            options={assignees.map((person) => ({
              value: person.id,
              label: person.name,
            }))}
          />
        )}
        {!clientView && (
          <Filter
            value={visibilityFilter}
            onChange={setVisibilityFilter}
            label="Visibility"
            options={[
              { value: "internal", label: "Internal" },
              { value: "client-visible", label: "Client-visible" },
            ]}
          />
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <section className="space-y-2" aria-labelledby="active-tasks-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="active-tasks-heading" className="font-medium">Active to-dos</h2>
          <span className="text-xs tabular-nums text-muted-foreground">{activeTasks.length}</span>
        </div>
        {renderList(activeTasks, false, tasks.some((task) => !task.archivedAt && task.status !== "done") ? "No active to-dos match these filters." : "No active to-dos.")}
      </section>

      <Collapsible open={completedOpen} onOpenChange={setCompletedOpen} className="rounded-lg border bg-card">
        <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
          <CheckCircle2 className="size-4 text-muted-foreground" />
          <span className="flex-1 font-medium">Completed ({completedTasks.length})</span>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${completedOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t p-3 data-[state=closed]:animate-out data-[state=open]:animate-in">
          {renderList(completedTasks, false, tasks.some((task) => !task.archivedAt && task.status === "done") ? "No completed to-dos match these filters." : "No completed to-dos yet.")}
        </CollapsibleContent>
      </Collapsible>

      {!clientView && (
        <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen} className="rounded-lg border bg-card">
          <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
            <Archive className="size-4 text-muted-foreground" />
            <span className="flex-1 font-medium">Archived ({archivedTasks.length})</span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${archivedOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t p-3 data-[state=closed]:animate-out data-[state=open]:animate-in">
            {renderList(archivedTasks, true, tasks.some((task) => task.archivedAt) ? "No archived to-dos match these filters." : "No archived to-dos.")}
          </CollapsibleContent>
        </Collapsible>
      )}
      <Dialog
        open={archiveId !== null}
        onOpenChange={(open) => {
          if (!open && (!archiveId || !mutations.isPending(`task:${archiveId}`))) setArchiveId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive task?</DialogTitle>
            <DialogDescription>
              The task will move to the Archived view, where it can be restored
              later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={Boolean(archiveId && mutations.isPending(`task:${archiveId}`))}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={Boolean(archiveId && mutations.isPending(`task:${archiveId}`))}
              onClick={() => archiveId && archive(archiveId)}
            >
              {archiveId && mutations.isPending(`task:${archiveId}`) && <Loader2 className="animate-spin" />}Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InlineSubtask({
  draft,
  setDraft,
  assignees,
  tasks,
  pending,
  onCancel,
  onCreate,
}: {
  draft: Draft;
  setDraft(value: Draft): void;
  assignees: TaskAssigneeOption[];
  tasks: ViewTask[];
  pending: boolean;
  onCancel(): void;
  onCreate(): void;
}) {
  return (
    <div className="ml-6 space-y-3 rounded-lg border border-l-4 bg-muted/30 p-4">
      <div>
        <p className="font-medium">New subtask</p>
        <p className="text-sm text-muted-foreground">
          This task will be nested under its parent.
        </p>
      </div>
      <Input
        autoFocus
        aria-label="Subtask title"
        placeholder="What is the next step?"
        value={draft.title}
        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        onKeyDown={(event) => event.key === "Enter" && onCreate()}
      />
      <details>
        <summary className="cursor-pointer text-sm text-muted-foreground">
          Add details
        </summary>
        <TaskFields
          idPrefix="new-subtask"
          draft={draft}
          setDraft={setDraft}
          assignees={assignees}
          tasks={tasks}
        />
      </details>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={onCreate} disabled={!draft.title.trim()}>
          <ListPlus />
          Create subtask
        </Button>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  depth,
  assignees,
  allTasks,
  readOnly,
  archived,
  expanded,
  pending,
  statusPending,
  onToggle,
  onExpand,
  onAddSubtask,
  onSave,
  onArchive,
  onRestore,
}: {
  task: ViewTask;
  depth: number;
  assignees: TaskAssigneeOption[];
  allTasks: ViewTask[];
  readOnly: boolean;
  archived: boolean;
  expanded: boolean;
  pending: boolean;
  statusPending: boolean;
  onToggle(): void;
  onExpand(): void;
  onAddSubtask(): void;
  onSave(values: Draft): Promise<boolean>;
  onArchive(): void;
  onRestore(): void;
}) {
  const parts = localParts(task.dueDate, task.dueAt);
  const [draft, setDraft] = useState<Draft>({
    title: task.title,
    description: task.description ?? "",
    assigneeIds: task.assigneeIds,
    priority: task.priority,
    ...parts,
    dueTimeSet: task.dueTimeSet,
    visibility: task.visibility,
    parentTaskId: task.parentTaskId ?? "none",
  });
  const [editing, setEditing] = useState(false);

  const dueLabel =
    task.dueTimeSet && task.dueAt
      ? new Date(task.dueAt).toLocaleString()
      : task.dueDate
        ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString()
        : null;
  return (
    <div
      id={`task-${task.id}`}
      className="scroll-mt-20"
    >
      <div
        className="flex min-h-11 items-center gap-3 px-3 py-2"
        style={{ paddingInlineStart: `${0.75 + Math.min(depth, 5) * 1.5}rem` }}
      >
        {depth > 0 && (
          <CornerDownRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        )}
        {!readOnly && !archived && !task.saving && (
          <Checkbox
            aria-label={
              task.status === "done"
                ? `Reopen ${task.title}`
                : `Complete ${task.title}`
            }
            checked={task.status === "done"}
            disabled={statusPending}
            aria-busy={statusPending}
            onCheckedChange={onToggle}
          />
        )}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`task-${task.id}-details`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 text-left outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={() => {
            setEditing(false);
            onExpand();
          }}
        >
          <span
            className={
              task.status === "done"
                ? "min-w-0 flex-1 truncate font-medium line-through text-muted-foreground"
                : "min-w-0 flex-1 truncate font-medium"
            }
          >
            {task.title}
          </span>
          {task.saving && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Saving…
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {expanded && (
        <div
          id={`task-${task.id}-details`}
          className="border-t bg-muted/20 px-4 py-4"
          style={{ paddingInlineStart: `${3 + Math.min(depth, 5) * 1.5}rem` }}
        >
          {editing ? (
            <>
              <TaskFields
                idPrefix={`task-${task.id}`}
                draft={draft}
                setDraft={setDraft}
                assignees={assignees}
                tasks={allTasks.filter((candidate) => candidate.id !== task.id)}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" disabled={pending} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={pending || !draft.title.trim()}
                  onClick={() => {
                    setEditing(false);
                    void onSave(draft).then((saved) => {
                      if (!saved) setEditing(true);
                    });
                  }}
                >
                  {pending && <Loader2 className="animate-spin" />}Save changes
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {task.description || "No description added."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={statusTone(task.status)} className="capitalize">
                  {task.status.replace("_", " ")}
                </StatusBadge>
                <StatusBadge tone={priorityTone(task.priority)} className="capitalize">
                  {task.priority}
                </StatusBadge>
                <VisibilityBadge visibility={task.visibility} />
              </div>
              {(dueLabel || (!readOnly && task.assigneeIds.length > 0)) && (
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {dueLabel && <span>Due {dueLabel}</span>}
                  {!readOnly && task.assigneeIds.length > 0 && (
                    <span>
                      Assigned to {task.assigneeIds
                        .map(
                          (id) => assignees.find((person) => person.id === id)?.name ?? id,
                        )
                        .join(", ")}
                    </span>
                  )}
                </div>
              )}
              {!readOnly && !task.saving && (
                <div className="flex flex-wrap gap-2">
                  {archived ? (
                    <Button size="sm" variant="outline" onClick={onRestore} disabled={pending}>
                      <RotateCcw /> Restore
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={onAddSubtask}>
                        <ListPlus /> Add subtask
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                        <Pencil /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={onArchive}>
                        <Archive /> Archive
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskFields({
  idPrefix,
  draft,
  setDraft,
  assignees,
  tasks,
}: {
  idPrefix: string;
  draft: Draft;
  setDraft(value: Draft): void;
  assignees: TaskAssigneeOption[];
  tasks: ViewTask[];
}) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          value={draft.title}
          onChange={(event) =>
            setDraft({ ...draft, title: event.target.value })
          }
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={draft.description}
          onChange={(event) =>
            setDraft({ ...draft, description: event.target.value })
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Priority</Label>
        <Select
          value={draft.priority}
          onValueChange={(value) =>
            setDraft({ ...draft, priority: value as Draft["priority"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["low", "medium", "high", "urgent"].map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Due date and time</Label>
        <DateTimePicker
          label="Due date"
          value={{
            date: draft.dueDate,
            time: draft.dueTime,
            includeTime: draft.dueTimeSet,
          }}
          onValueChange={(value) =>
            setDraft({
              ...draft,
              dueDate: value.date,
              dueTime: value.time,
              dueTimeSet: value.includeTime,
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Parent task</Label>
        <Select
          value={draft.parentTaskId}
          onValueChange={(value) => setDraft({ ...draft, parentTaskId: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No parent</SelectItem>
            {tasks.map((task) => (
              <SelectItem key={task.id} value={task.id}>
                {task.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <VisibilityControl
        id={`${idPrefix}-visibility`}
        value={draft.visibility}
        onValueChange={(visibility) => setDraft({ ...draft, visibility })}
      />
      <fieldset className="space-y-2 sm:col-span-2">
        <legend className="text-sm font-medium">Assignees</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {assignees.map((person) => (
            <label
              key={person.id}
              className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <Checkbox
                checked={draft.assigneeIds.includes(person.id)}
                onCheckedChange={(checked) =>
                  setDraft({
                    ...draft,
                    assigneeIds: checked
                      ? [...draft.assigneeIds, person.id]
                      : draft.assigneeIds.filter((id) => id !== person.id),
                  })
                }
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">{person.name}</span>
                {person.email && person.email !== person.name && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {person.email}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function Filter({
  value,
  onChange,
  label,
  values,
  options,
}: {
  value: string;
  onChange(value: string): void;
  label: string;
  values?: string[];
  options?: { value: string; label: string }[];
}) {
  const items =
    options ??
    values!.map((item) => ({ value: item, label: item.replace("_", " ") }));
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={`Filter by ${label.toLowerCase()}`}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All {label.toLowerCase()}s</SelectItem>
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className="capitalize"
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
