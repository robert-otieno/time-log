"use client";

import * as React from "react";
import { NavProjects } from "@/components/nav-projects";
import { Sidebar, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" {...props}>
      <SidebarContent>
        <NavProjects />
      </SidebarContent>
      <SidebarFooter></SidebarFooter>
    </Sidebar>
  );
}
