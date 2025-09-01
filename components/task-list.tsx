"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatISODateString, formatISODate } from "@/lib/date-utils";
import TaskForm from "@/components/task-form";
import TaskItem from "@/components/task-item";
import WeeklyPriorityList from "@/components/weekly-priority-list";
import Goals from "@/components/goals";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { useTasks, UITask } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/use-tags";

export default function TaskList({ focusMode = false }: { focusMode?: boolean }) {
  const { selectedDate: date, setSelectedDate } = useSelectedDate();
  const { tasks, weeklyPriorities, addTask, toggleTask, deleteTask, addSubtask, toggleSubtask, deleteSubtask, updateTask, moveIncompleteToToday } = useTasks(date);
  const today = formatISODate(new Date());
  const { tags, loadTags } = useTags();

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

        <CardContent className={`p-0 , ${cn(focusMode ? "grid-cols-1" : "grid-cols-2")}`}>
          <Card className="grid grid-cols-1 md:grid-cols-2 border-0 p-0 shadow-none rounded-none bg-card/0">
            <div>
              <CardHeader>
                <TaskForm onAdd={addTask} weeklyPriorities={weeklyPriorities} tags={tags} onTagsUpdated={loadTags} />
                <div className="flex items-center justify-between">
                  <CardTitle>Daily Tasks</CardTitle>
                  {date !== today && tasks.some((t) => !t.done) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const moved = await moveIncompleteToToday();
                        if (moved > 0) {
                          setSelectedDate(today);
                        }
                      }}
                    >
                      Move incomplete to today
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {tasks.length === 0 ? (
                  <ul>
                    <li className="py-6 text-sm text-muted-foreground">Nothing scheduled. Try “Newsletter Q2 outline.”</li>
                  </ul>
                ) : (
                  orderedGroups.map(([tag, tagTasks]) => (
                    <div key={tag}>
                      <ul className="divide-y">
                        {tagTasks.map((task) => (
                          <TaskItem key={task.id} task={task} onToggleTask={toggleTask} onDeleteTask={deleteTask} onAddSubtask={addSubtask} onToggleSubtask={toggleSubtask} onDeleteSubtask={deleteSubtask} onUpdateTask={updateTask} weeklyPriorities={weeklyPriorities} tags={tags} />
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </CardContent>
            </div>

            <div>
              {!focusMode && (
                <div className="space-y-6">
                  <Goals />
                  <WeeklyPriorityList />
                </div>
              )}
            </div>
          </Card>
        </CardContent>
      </Card>
    </>
  );
}
