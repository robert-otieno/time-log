"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import TaskList from "./TaskList";
import { formatISODate } from "@/lib/date-utils";

export default function TaskDashboard() {
  const format = (date: Date) => date.toLocaleDateString(undefined, { year: "numeric", month: "numeric", day: "numeric" });

  const [selectedDate, setSelectedDate] = useState(formatISODate(new Date()));
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <SidebarInset>
            <TaskList date={selectedDate} />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
