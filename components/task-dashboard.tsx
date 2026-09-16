"use client";

import { SiteHeader } from "@/components/site-header";
import TaskList from "@/components/task-list";
import { formatISODate } from "@/lib/date-utils";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useFocusMode } from "@/hooks/use-focus-mode";
import { useSelectedDate } from "@/hooks/use-selected-date";

export default function TaskDashboard() {
  const { setSelectedDate } = useSelectedDate();
  const { focusMode, toggleFocusMode } = useFocusMode();

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
      <SiteHeader />
      <div className="flex flex-1 transition-all duration-300">
        <div className="container mx-auto">
          <TaskList focusMode={focusMode} />
        </div>
      </div>
    </div>
  );
}
