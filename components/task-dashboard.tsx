"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import TaskList from "@/components/task-list";
import { formatISODate } from "@/lib/date-utils";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useFocusMode } from "@/hooks/use-focus-mode";
import { useSelectedDate } from "@/hooks/use-selected-date";

export default function TaskDashboard() {
  const { setSelectedDate } = useSelectedDate();
  const { toggleFocusMode } = useFocusMode();

  useShortcuts({
    onNewTask: () => {
      const el = document.querySelector<HTMLInputElement>('input[placeholder^="New task"]');
      el?.focus();
    },
    onToday: () => {
      setSelectedDate(formatISODate(new Date()));
    },
    onGoals: () => {
      document.getElementById("goals")?.scrollIntoView({ behavior: "smooth" });
    },
    onPriorities: () => {
      document.getElementById("weekly-priorities")?.scrollIntoView({ behavior: "smooth" });
    },
    onFocusMode: () => {
      toggleFocusMode();
    },
  });
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset>
            <TaskList />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
