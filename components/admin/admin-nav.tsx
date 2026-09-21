"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/people", label: "People", icon: Users, exact: false },
  { href: "/activity", label: "Activity", icon: Activity, exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  return <nav aria-label="Administration" className="border-b bg-background"><div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">{items.map(({ href, label, icon: Icon, exact }) => { const active = exact ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm text-muted-foreground hover:text-foreground", active && "border-primary font-medium text-foreground")}><Icon className="size-4" />{label}</Link>; })}</div></nav>;
}
