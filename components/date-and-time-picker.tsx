"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Calendar24({
  v_deadline,
  fn_deadline,
  v_reminder,
  fn_reminder,
}: {
  v_deadline: string;
  fn_deadline: (e: React.ChangeEvent<HTMLInputElement>) => void;
  v_reminder: string;
  fn_reminder: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex gap-2">
      {/*  */}
      <div className="flex flex-col">
        <Tooltip>
          <TooltipTrigger asChild>
            <Input
              type="time"
              id="reminder"
              step="1"
              defaultValue="10:30:00"
              value={v_deadline}
              onChange={fn_deadline}
              className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>Deadline</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-col">
        <Tooltip>
          <TooltipTrigger asChild>
            <Input
              type="time"
              id="reminder"
              step="1"
              defaultValue="10:30:00"
              value={v_reminder}
              onChange={fn_reminder}
              className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>Reminder</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
