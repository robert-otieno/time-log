import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "blocked" | "info" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-status-success text-status-success-foreground",
  warning: "bg-status-warning text-status-warning-foreground",
  blocked: "bg-status-blocked text-status-blocked-foreground",
  info: "bg-status-info text-status-info-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export function statusTone(value: string): StatusTone {
  if (["active", "accepted", "approved", "completed", "delivered", "done", "executed", "sent", "succeeded"].includes(value)) return "success";
  if (["in_progress", "invited", "on_hold", "pending", "processing", "queued"].includes(value)) return "warning";
  if (["blocked", "denied", "failed", "rejected", "suspended"].includes(value)) return "blocked";
  if (["client-visible", "todo"].includes(value)) return "info";
  return "neutral";
}

export function priorityTone(value: string): StatusTone {
  if (value === "urgent") return "blocked";
  if (value === "high") return "warning";
  if (value === "medium") return "info";
  return "neutral";
}

export function StatusBadge({ tone, className, children, ...props }: Omit<ComponentProps<typeof Badge>, "variant"> & { tone: StatusTone }) {
  return <Badge variant="secondary" className={cn(toneClasses[tone], className)} {...props}>
    <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
    {children}
  </Badge>;
}
