"use client";

import { Power, SidebarIcon } from "lucide-react";

import { SearchForm } from "@/components/search-form";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { useEffect, useState } from "react";
import { CommandMenu } from "./command-menu";
import { signOut } from "firebase/auth";
import { auth } from "@/db";
// import { useAuth } from "@/components/auth-provider";

export function SiteHeader() {
  const { toggleSidebar } = useSidebar();
  const [open, setOpen] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <header className="bg-background sticky top-0 z-50 flex w-full items-center border-b">
        <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
          <Button className="h-8 w-8" variant="ghost" size="icon" onClick={toggleSidebar}>
            <SidebarIcon />
          </Button>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Activity Tracker</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <SearchForm className="w-full sm:ml-auto sm:w-auto" />
          {user && (
            <Button variant="ghost" size="icon" onClick={() => signOut(auth)} className="ml-2">
              <Power />
            </Button>
          )}
        </div>
      </header>
      <CommandMenu open={open} setOpen={setOpen} />
    </>
  );
}
