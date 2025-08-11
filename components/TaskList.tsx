"use client";

import { useState, useEffect } from "react";
import { addDailyTask, toggleDailyTask, deleteDailyTask, getTodayTasks } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export default function TaskList() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    const res = await getTodayTasks(today);
    setTasks(res);
  }

  async function handleAddTask() {
    if (!newTask.trim()) return;
    await addDailyTask(newTask, today);
    setNewTask("");
    await loadTasks();
  }

  async function handleToggleTask(id: number, done: boolean) {
    await toggleDailyTask(id, !done);
    await loadTasks();
  }

  async function handleDeleteTask(id: number) {
    await deleteDailyTask(id);
    await loadTasks();
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Daily Tasks</h2>
      <div className="flex gap-2">
        <Input
          placeholder="New task..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
        />
        <Button onClick={handleAddTask}>Add</Button>
      </div>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-2 border p-2 rounded"
          >
            <Checkbox
              checked={task.done}
              onCheckedChange={() => handleToggleTask(task.id, task.done)}
            />
            <span className={task.done ? "line-through text-gray-500" : ""}>
              {task.title}
            </span>
            <Button
              variant="destructive"
              size="sm"
              className="ml-auto"
              onClick={() => handleDeleteTask(task.id)}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
