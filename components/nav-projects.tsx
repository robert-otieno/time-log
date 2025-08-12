"use client"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { SidebarDateProps } from "@/lib/sidebar-date-props";

export function NavProjects({ selectedDate, onSelectDate }: SidebarDateProps) {
  const { isMobile } = useSidebar()

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "numeric", day: "numeric" });
  });

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {days.map((day) => (
          <SidebarMenuItem key={day}>
            <SidebarMenuButton asChild>
              <button
                className={`block w-full text-left px-2 py-1 rounded ${selectedDate === day ? "bg-muted" : ""}`}
                onClick={() => onSelectDate(day)}
              >
                {day}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
