"use client";

import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestTimerStart } from "@/components/time/global-timer-control";

export function TimerStartButton({ projectId, taskId, label = "Track time", variant = "outline" }: { projectId?: string; taskId?: string; label?: string; variant?: "default" | "outline" }) {
  return <Button size="sm" variant={variant} onClick={() => requestTimerStart({ projectId, taskId })}><Clock3 />{label}</Button>;
}
