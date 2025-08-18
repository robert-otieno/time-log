"use client";

import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";
import { Calendar } from "@/components/ui/calendar";
import { formatISODate } from "@/lib/date-utils";
import { SidebarDateProps } from "@/lib/sidebar-date-props";

export function NavProjects({ selectedDate, onSelectDate }: SidebarDateProps) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Select Date</SidebarGroupLabel>
      <SidebarGroupContent>
        <Calendar
          mode="single"
          selected={selectedDate ? new Date(selectedDate) : undefined}
          onSelect={(date) => {
            if (date) onSelectDate(formatISODate(date));
          }}
          className="w-full p-1 border rounded-lg border-input bg-background"
        />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
