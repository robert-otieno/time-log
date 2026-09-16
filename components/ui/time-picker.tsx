"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TimePickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  label: string;
};

const hours = Array.from({ length: 12 }, (_, index) => String(index + 1));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour24 = match ? Number(match[1]) : 9;
  const minute = match ? match[2] : "00";

  return {
    hour: String(hour24 % 12 || 12),
    minute,
    period: hour24 >= 12 ? "PM" : "AM",
  };
}

function formatTime(hour: string, minute: string, period: string) {
  const hour12 = Number(hour);
  const hour24 = period === "PM" ? (hour12 % 12) + 12 : hour12 % 12;
  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

export function TimePicker({
  value,
  onValueChange,
  disabled,
  label,
  "aria-invalid": ariaInvalid,
}: TimePickerProps) {
  const time = parseTime(value);

  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <Select
        value={time.hour}
        onValueChange={(hour) => onValueChange(formatTime(hour, time.minute, time.period))}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" aria-label={`${label} hour`} aria-invalid={ariaInvalid}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {hours.map((hour) => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground" aria-hidden="true">:</span>
      <Select
        value={time.minute}
        onValueChange={(minute) => onValueChange(formatTime(time.hour, minute, time.period))}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" aria-label={`${label} minute`} aria-invalid={ariaInvalid}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {minutes.map((minute) => <SelectItem key={minute} value={minute}>{minute}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select
        value={time.period}
        onValueChange={(period) => onValueChange(formatTime(time.hour, time.minute, period))}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" aria-label={`${label} AM or PM`} aria-invalid={ariaInvalid}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
