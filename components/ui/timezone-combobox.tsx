"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TimezoneComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  "aria-invalid"?: boolean;
};

const fallbackTimezones = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function TimezoneCombobox({
  value,
  onValueChange,
  disabled,
  "aria-invalid": ariaInvalid,
}: TimezoneComboboxProps) {
  const [open, setOpen] = useState(false);
  const timezones = useMemo(() => {
    const supportedValuesOf = Intl.supportedValuesOf as ((key: "timeZone") => string[]) | undefined;
    const available = supportedValuesOf ? supportedValuesOf("timeZone") : fallbackTimezones;
    return Array.from(new Set(["UTC", value, ...available].filter(Boolean)));
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{value || "Select a timezone"}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search timezones…" />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {timezones.map((timezone) => (
                <CommandItem
                  key={timezone}
                  value={timezone}
                  onSelect={() => {
                    onValueChange(timezone);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2", value === timezone ? "opacity-100" : "opacity-0")} />
                  {timezone.replaceAll("_", " ")}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
