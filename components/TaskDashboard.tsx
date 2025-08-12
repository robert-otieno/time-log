"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import TaskList from "./TaskList";

export default function TaskDashboard() {
  const format = (date: Date) =>
    date.toLocaleDateString(undefined, { year: "numeric", month: "numeric", day: "numeric" });

  const [selectedDate, setSelectedDate] = useState(format(new Date()));
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <SidebarInset>
            <div className="p-4">
              <TaskList date={selectedDate} />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}
