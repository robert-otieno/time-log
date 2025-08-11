"use client";

import { useState } from "react";
import TaskList from "./TaskList";
import PastDaysSidebar from "./PastDaysSidebar";

export default function TaskDashboard() {
  const format = (date: Date) =>
    date.toLocaleDateString(undefined, { year: "numeric", month: "numeric", day: "numeric" });

  const [selectedDate, setSelectedDate] = useState(format(new Date()));

  return (
    <div className="flex gap-6">
      <PastDaysSidebar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      <div className="flex-1">
        <TaskList date={selectedDate} />
      </div>
    </div>
  );
}