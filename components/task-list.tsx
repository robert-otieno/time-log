"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatISODateString } from "@/lib/date-utils";
import TaskForm from "@/components/task-form";
import TaskItem from "@/components/task-item";
import WeeklyPriorityList from "@/components/weekly-priority-list";
import Goals from "@/components/goals";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { useTasks, UITask } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/use-tags";
import TaskDetailsDialog from "@/components/task-details-dialog";
import TaskEditDialog from "@/components/task-edit-dialog";

export default function TaskList({ focusMode = false }: { focusMode?: boolean }) {
  const { selectedDate: date } = useSelectedDate();
  const { tasks, weeklyPriorities, addTask, toggleTask, deleteTask, addSubtask, toggleSubtask, deleteSubtask, updateTask, loadTasks } = useTasks(date);
  const { tags, loadTags } = useTags();
  const [editingTask, setEditingTask] = useState<UITask | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const timers: number[] = [];
    tasks.forEach((t) => {
      if (t.reminderTime && !t.done) {
        const remindAt = new Date(t.reminderTime);
        const delay = remindAt.getTime() - Date.now();
        if (delay > 0) {
          const id = window.setTimeout(() => {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(t.title, {
                body: t.deadline ? `Due at ${new Date(t.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : undefined,
              });
            }
          }, delay);
          timers.push(id);
        }
      }
    });
    return () => {
      timers.forEach((id) => clearTimeout(id));
    };
  }, [tasks]);

  const groupedTasks = tasks.reduce<Record<string, UITask[]>>((groups, task) => {
    const tag = task.tag || "other";
    (groups[tag] = groups[tag] || []).push(task);
    return groups;
  }, {});

  const tagOrder = tags.map((t) => t.id);
  const orderedGroups = Object.entries(groupedTasks).sort((a, b) => {
    const idxA = tagOrder.indexOf(a[0]);
    const idxB = tagOrder.indexOf(b[0]);
    return (idxA === -1 ? tagOrder.length : idxA) - (idxB === -1 ? tagOrder.length : idxB);
  });

  return (
    <>
      <Card className="border-0 shadow-none rounded-none bg-card/0">
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>{formatISODateString(date)}</CardDescription>
        </CardHeader>

        <CardContent className={cn("grid gap-4 transition-all", focusMode ? "grid-cols-1" : "grid-cols-2")}>
          <Card className="border-0 p-0 shadow-none rounded-none bg-card/0">
            <CardHeader>
              <TaskForm onAdd={addTask} weeklyPriorities={weeklyPriorities} tags={tags} onTagsUpdated={loadTags} />
              <CardTitle>Daily Tasks</CardTitle>
            </CardHeader>

            <CardContent>
              {tasks.length === 0 ? (
                <ul className="divide-y">
                  <li className="py-6 text-sm text-muted-foreground">Nothing scheduled. Try “Newsletter Q2 outline.”</li>
                </ul>
              ) : (
                orderedGroups.map(([tag, tagTasks]) => (
                  <div key={tag}>
                    <ul>
                      {tagTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onToggleTask={toggleTask}
                          onDeleteTask={deleteTask}
                          onAddSubtask={addSubtask}
                          onToggleSubtask={toggleSubtask}
                          onDeleteSubtask={deleteSubtask}
                          onEdit={(t) => setEditingTask(t)}
                          onSelect={(id) => setSelectedTaskId(id)}
                          onUpdateTask={updateTask}
                          weeklyPriorities={weeklyPriorities}
                          tags={tags}
                        />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {!focusMode && (
            <div className="space-y-6">
              <Goals />
              <WeeklyPriorityList />
            </div>
          )}
        </CardContent>
      </Card>

      <TaskEditDialog
        task={editingTask}
        open={editingTask !== null}
        onOpenChange={(o) => {
          if (!o) setEditingTask(null);
        }}
        weeklyPriorities={weeklyPriorities}
        onSave={updateTask}
        tags={tags}
        onTagsUpdated={loadTags}
      />

      <TaskDetailsDialog
        task={tasks.find((t) => t.id === selectedTaskId) ?? null}
        open={selectedTaskId !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedTaskId(null);
        }}
        onSaved={async () => {
          await loadTasks();
          setSelectedTaskId(null);
        }}
      />
    </>
  );
}
