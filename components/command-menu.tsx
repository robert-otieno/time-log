"use client";

import { useRouter } from "next/navigation";
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatISODate } from "@/lib/date-utils";
import { useSelectedDate } from "@/hooks/use-selected-date";

interface CommandMenuProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function CommandMenu({ open, setOpen }: CommandMenuProps) {
  const router = useRouter();
  const { setSelectedDate } = useSelectedDate();

  function openTaskQuickAdd() {
    const el = document.querySelector<HTMLInputElement>('input[placeholder^="New task"]');
    el?.focus();
  }

  function openHabitQuickAdd() {
    const el = document.querySelector<HTMLInputElement>('input[placeholder="New habit"]');
    el?.focus();
  }

  function openPriorityQuickAdd() {
    const el = document.querySelector<HTMLInputElement>('input[placeholder^="New priority"]');
    el?.focus();
  }

  function openGoalQuickAdd() {
    const el = document.querySelector<HTMLInputElement>('input[placeholder="Goal"]');
    el?.focus();
  }

  function goToday() {
    const today = formatISODate(new Date());
    setSelectedDate(today);
    router.push("/");
  }

  function goWeek() {
    router.push("/week");
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandGroup heading="Create">
          <CommandItem
            onSelect={() => {
              openTaskQuickAdd();
              setOpen(false);
            }}
          >
            New task
          </CommandItem>
          <CommandItem
            onSelect={() => {
              openHabitQuickAdd();
              setOpen(false);
            }}
          >
            New habit
          </CommandItem>
          <CommandItem
            onSelect={() => {
              openPriorityQuickAdd();
              setOpen(false);
            }}
          >
            New priority
          </CommandItem>
          <CommandItem
            onSelect={() => {
              openGoalQuickAdd();
              setOpen(false);
            }}
          >
            New goal
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Navigate">
          <CommandItem
            onSelect={() => {
              goToday();
              setOpen(false);
            }}
          >
            Go to Today
          </CommandItem>
          <CommandItem
            onSelect={() => {
              goWeek();
              setOpen(false);
            }}
          >
            Go to this Week
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
