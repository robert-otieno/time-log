"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const router = useRouter();
  const [tasks, setTasks] = useState<ViewTask[]>(initialTasks);
  const [draft, setDraft] = useState(blank);
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null);
  const [subtaskDraft, setSubtaskDraft] = useState(blank);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showArchived, setShowArchived] = useState(false);
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

  const scoped = useMemo(
    () => tasks.filter((task) => Boolean(task.archivedAt) === showArchived),
    [tasks, showArchived],
  );
  const visible = useMemo(
    () =>
      scoped.filter(
        (task) =>
          (statusFilter === "all"
            ? showArchived || task.status !== "done"
            : task.status === statusFilter) &&
          (priorityFilter === "all" || task.priority === priorityFilter) &&
          (assigneeFilter === "all" ||
            task.assigneeIds.includes(assigneeFilter)) &&
          (visibilityFilter === "all" || task.visibility === visibilityFilter),
      ),
    [scoped, showArchived, statusFilter, priorityFilter, assigneeFilter, visibilityFilter],
  );
  const top = visible.filter(
    (task) =>
      !task.parentTaskId ||
      !visible.some((parent) => parent.id === task.parentTaskId),
  );
  const archivedCount = tasks.filter((task) => task.archivedAt).length;

  const create = (values: Draft, reset: () => void) => {
    if (!values.title.trim()) return;
    const optimisticId = `pending-${crypto.randomUUID()}`;
    const sortOrder = tasks.length;
    setError(null);
    setShowArchived(false);
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    setVisibilityFilter("all");
    setTasks((current) => [
      ...current,
      optimisticTask(optimisticId, values, sortOrder),
    ]);
    reset();
    startTransition(async () => {
      const result = await createTaskAction(
        projectId,
        command(values, sortOrder),
      );
      if (!result.ok) {
        setTasks((current) =>
          current.filter((task) => task.id !== optimisticId),
        );
        setError(result.error);
        return;
      }
      setTasks((current) =>
        current.map((task) =>
          task.id === optimisticId
            ? { ...task, id: result.data.id, saving: false }
            : task,
        ),
      );
      router.refresh();
    });
  };

  const mutateStatus = (task: ViewTask) => {
    const next = task.status === "done" ? "todo" : "done";
    const previous = tasks;
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, status: next } : item,
      ),
    );
    setError(null);
    startTransition(async () => {
      const result = await changeTaskStatusAction(projectId, task.id, next);
      if (!result.ok) {
        setTasks(previous);
        setError(result.error);
      } else router.refresh();
    });
  };

  const openSubtask = (taskId: string) => {
    setSubtaskParentId(taskId);
    setSubtaskDraft(blank(taskId));
    setExpanded(null);
  };
  const restore = (taskId: string) =>
    startTransition(async () => {
      const result = await restoreTaskAction(projectId, taskId);
      if (!result.ok) setError(result.error);
      else {
        setTasks((current) =>
          current.map((item) =>
            item.id === taskId ? { ...item, archivedAt: null } : item,
          ),
        );
        router.refresh();
      }
    });

  const orderedTasks: { task: ViewTask; depth: number }[] = [];
  const appendTask = (task: ViewTask, depth = 0) => {
    orderedTasks.push({ task, depth });
    const children = visible.filter(
      (candidate) => candidate.parentTaskId === task.id,
    );
    children.forEach((child) => appendTask(child, depth + 1));
  };
  top.forEach((task) => appendTask(task));

  const renderTask = (task: ViewTask, depth: number): ReactNode => (
    <div key={task.id} className="border-b last:border-b-0">
      <TaskRow
          task={task}
          depth={depth}
          projectId={projectId}
          assignees={assignees}
          allTasks={tasks.filter((candidate) => !candidate.archivedAt)}
          readOnly={readOnly}
          archived={showArchived}
          expanded={expanded === task.id}
          pending={pending}
          onToggle={() => mutateStatus(task)}
          onExpand={() => setExpanded(expanded === task.id ? null : task.id)}
          onAddSubtask={() => openSubtask(task.id)}
          onSaved={(values) => {
            const updated = command(values, task.sortOrder);
            setTasks((current) =>
              current.map((item) =>
                item.id === task.id ? { ...item, ...updated } : item,
              ),
            );
            router.refresh();
          }}
          onError={setError}
          onArchive={() => setArchiveId(task.id)}
          onRestore={() => restore(task.id)}
      />
      {subtaskParentId === task.id && !showArchived && (
        <InlineSubtask
            draft={subtaskDraft}
            setDraft={setSubtaskDraft}
            assignees={assignees}
            tasks={tasks.filter((candidate) => !candidate.archivedAt)}
            pending={pending}
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

  return (
    <div className="space-y-5">
      {!readOnly && !showArchived && (
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
      {!clientView && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Task lifecycle view"
        >
          <Button
            size="sm"
            variant={showArchived ? "outline" : "default"}
            onClick={() => setShowArchived(false)}
          >
            Active
          </Button>
          <Button
            size="sm"
            variant={showArchived ? "default" : "outline"}
            onClick={() => setShowArchived(true)}
          >
            Archived ({archivedCount})
          </Button>
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
      {top.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
          {scoped.length === 0
            ? showArchived
              ? "No archived tasks."
              : "No active tasks."
            : "No tasks match these filters."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          {orderedTasks.map(({ task, depth }) => renderTask(task, depth))}
        </div>
      )}
      <Dialog
        open={archiveId !== null}
        onOpenChange={(open) => !pending && !open && setArchiveId(null)}
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
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                archiveId &&
                startTransition(async () => {
                  const result = await archiveTaskAction(projectId, archiveId);
                  if (!result.ok) setError(result.error);
                  else {
                    setTasks((current) =>
                      current.map((task) =>
                        task.id === archiveId
                          ? { ...task, archivedAt: new Date().toISOString() }
                          : task,
                      ),
                    );
                    setArchiveId(null);
                    router.refresh();
                  }
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />}Archive
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
  projectId,
  assignees,
  allTasks,
  readOnly,
  archived,
  expanded,
  pending,
  onToggle,
  onExpand,
  onAddSubtask,
  onSaved,
  onError,
  onArchive,
  onRestore,
}: {
  task: ViewTask;
  depth: number;
  projectId: string;
  assignees: TaskAssigneeOption[];
  allTasks: ViewTask[];
  readOnly: boolean;
  archived: boolean;
  expanded: boolean;
  pending: boolean;
  onToggle(): void;
  onExpand(): void;
  onAddSubtask(): void;
  onSaved(values: Draft): void;
  onError(value: string): void;
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
  const [saving, startSaving] = useTransition();
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
            disabled={pending}
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
                <Button variant="outline" disabled={saving} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={saving || !draft.title.trim()}
                  onClick={() =>
                    startSaving(async () => {
                      const result = await updateTaskAction(projectId, {
                        taskId: task.id,
                        ...command(draft, task.sortOrder),
                      });
                      if (!result.ok) onError(result.error);
                      else {
                        onSaved(draft);
                        setEditing(false);
                      }
                    })
                  }
                >
                  {saving && <Loader2 className="animate-spin" />}Save changes
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
                <Badge variant="outline" className="capitalize">
                  {task.status.replace("_", " ")}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {task.priority}
                </Badge>
                <VisibilityBadge visibility={task.visibility} />
              </div>
              {(dueLabel || (!readOnly && task.assigneeIds.length > 0)) && (
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {dueLabel && <span>Due {dueLabel}</span>}
                  {!readOnly && task.assigneeIds.length > 0 && (
                    <span>
                      Assigned to {task.assigneeIds
                        .map(
                          (id) => assignees.find((person) => person.id === id)?.name ?? "Team member",
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
        <div className="flex flex-wrap gap-3">
          {assignees.map((person) => (
            <label key={person.id} className="flex items-center gap-2 text-sm">
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
              {person.name}
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
