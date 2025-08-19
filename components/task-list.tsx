"use client";

import { useState, useEffect } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatISODateString } from "@/lib/date-utils";
import TaskForm from "@/components/task-form";
import TaskItem from "@/components/task-item";
import TaskEditSheet from "@/components/task-edit-sheet";
import TaskDetailsSheet from "@/components/task-details-sheet";
import WeeklyPriorityList from "@/components/weekly-priority-list";
import Goals from "@/components/goals";
import { useSelectedDate } from "@/hooks/use-selected-date";

import { useTasks, UITask } from "@/hooks/use-tasks";
import { tagOptions } from "@/lib/tasks";

export default function TaskList() {
  const { selectedDate: date } = useSelectedDate();
  const { tasks, weeklyPriorities, addTask, toggleTask, deleteTask, addSubtask, toggleSubtask, deleteSubtask, updateTask, loadTasks } = useTasks(date);
  const [editingTask, setEditingTask] = useState<UITask | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

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
    const tag = task.tag || "Other";
    (groups[tag] = groups[tag] || []).push(task);
    return groups;
  }, {});

  const orderedGroups = Object.entries(groupedTasks).sort((a, b) => {
    const idxA = tagOptions.indexOf(a[0]);
    const idxB = tagOptions.indexOf(b[0]);
    return (idxA === -1 ? tagOptions.length : idxA) - (idxB === -1 ? tagOptions.length : idxB);
  });

  return (
    <>
      <Card className="border-0 shadow-none rounded-none bg-card/0">
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>{formatISODateString(date)}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-6 grid-cols-2">
          <Card className="border-0 p-0 shadow-none rounded-none bg-card/0">
            <CardHeader>
              <TaskForm onAdd={addTask} weeklyPriorities={weeklyPriorities} />
              <CardTitle>Daily Tasks</CardTitle>
            </CardHeader>

            <CardContent>
              {tasks.length === 0 ? (
                <ul className="divide-y">
                  <li className="py-6 text-sm text-muted-foreground">Nothing scheduled. Try “STEAM Bingo Card – GBDCEI” or “Newsletter Q2 outline.”</li>
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
                        />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div>
            <Goals />
            <WeeklyPriorityList />
          </div>
        </CardContent>
      </Card>

      <TaskEditSheet
        task={editingTask}
        open={editingTask !== null}
        onOpenChange={(o) => !o && setEditingTask(null)}
        weeklyPriorities={weeklyPriorities}
        onSave={updateTask}
      />

      <TaskDetailsSheet
        task={tasks.find((t) => t.id === selectedTaskId) ?? null}
        open={selectedTaskId !== null}
        onOpenChange={(o) => !o && setSelectedTaskId(null)}
        onSaved={async () => {
          await loadTasks();
          setSelectedTaskId(null);
        }}
      />
    </>
  );
}
