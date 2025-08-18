"use client";

import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";
import { Calendar } from "@/components/ui/calendar";
import { formatISODate } from "@/lib/date-utils";
import { useSelectedDate } from "@/hooks/use-selected-date";

export function NavProjects() {
  const { selectedDate, setSelectedDate } = useSelectedDate();

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="text-base">Calendar</SidebarGroupLabel>
      <SidebarGroupContent>
        <Calendar
          mode="single"
          selected={selectedDate ? new Date(selectedDate) : undefined}
          onSelect={(date) => {
            if (date) setSelectedDate(formatISODate(date));
          }}
          className="w-full p-4 border rounded-lg border-input bg-background"
        />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
