"use client";

import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/time-picker";

type DateTimeValue = { date: string; time: string; includeTime: boolean };

function localDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function DateTimePicker({ value, onValueChange, label, disabled }: { value: DateTimeValue; onValueChange(value: DateTimeValue): void; label: string; disabled?: boolean }) {
  const selected = localDate(value.date);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" disabled={disabled} className="min-w-0 flex-1 justify-start font-normal">
              <CalendarIcon />
              {selected ? format(selected, "PPP") : "Choose date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(date) => date && onValueChange({ ...value, date: format(date, "yyyy-MM-dd") })}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {value.date && <Button type="button" size="icon" variant="ghost" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onValueChange({ date: "", time: "09:00", includeTime: false })}><X /></Button>}
      </div>
      {value.date && <label className="flex items-center gap-2 text-sm"><Checkbox checked={value.includeTime} disabled={disabled} onCheckedChange={(checked) => onValueChange({ ...value, includeTime: checked === true })} />Include a time</label>}
      {value.date && value.includeTime && <TimePicker value={value.time || "09:00"} onValueChange={(time) => onValueChange({ ...value, time })} disabled={disabled} label={`${label} time`} />}
    </div>
  );
}
