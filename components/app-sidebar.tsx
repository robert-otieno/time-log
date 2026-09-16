"use client";

import * as React from "react";
import { NavProjects } from "@/components/nav-projects";
import { Sidebar, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import Link from "next/link";
import { Users } from "lucide-react";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" {...props}>
      <SidebarContent>
        <div className="px-4 pt-4 group-data-[collapsible=icon]:hidden"><Link href="/people" className="hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"><Users className="size-4" />People</Link></div>
        <NavProjects />
      </SidebarContent>
      <SidebarFooter></SidebarFooter>
    </Sidebar>
  );
}
