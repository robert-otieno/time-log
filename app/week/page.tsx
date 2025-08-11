import React from "react";
import { getWeeklyPriorities, addWeeklyPriority, deleteWeeklyPriority } from "../actions";

export default async function WeekPage() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  const weekStart = monday.toISOString().split("T")[0];

  const priorities = await getWeeklyPriorities(weekStart);

  async function handleAddPriority(formData: FormData) {
    "use server";
    const title = formData.get("title") as string;
    await addWeeklyPriority(title, weekStart);
  }

  async function handleDeletePriority(id: number) {
    "use server";
    await deleteWeeklyPriority(id);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Weekly Priorities — starting {weekStart}</h2>
      <form action={handleAddPriority} className="flex gap-2">
        <input type="text" name="title" placeholder="Add priority" className="border p-2 rounded flex-1" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
      </form>
      <ul className="space-y-2">
        {priorities.map((p) => (
          <li key={p.id} className="flex justify-between items-center border p-2 rounded">
            <span>{p.title}</span>
            <form action={() => handleDeletePriority(p.id)}>
              <button type="submit" className="text-red-500">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
