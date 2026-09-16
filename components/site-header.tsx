"use client";

import { Separator } from "@/components/ui/separator";
import { SearchForm } from "@/components/search-form";
import { useEffect, useState } from "react";
import { CommandMenu } from "./command-menu";
import { clientAuth } from "@/lib/firebase-client";
import ThemeSwitch from "@/components/theme-switch";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { CalendarButton } from "@/components/calendar-button";
import { LogoutButton } from "@/components/logout-button";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const user = clientAuth.currentUser;

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
          <CalendarButton />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-sm leading-tight">
                  <span className="truncate font-medium">Visio Genesis</span> - <span className="truncate text-xs">Notebook</span>
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <SearchForm className="w-full sm:ml-auto sm:w-auto" />
          <ThemeSwitch />
          {user && <LogoutButton />}
        </div>
      </header>
      <CommandMenu open={open} setOpen={setOpen} />
    </>
  );
}
