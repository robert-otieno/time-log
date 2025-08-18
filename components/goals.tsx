"use client";

import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatISODate } from "@/lib/date-utils";
import { toast } from "sonner";
import { useState } from "react";

export default function Goals() {
  const [newCategory, setNewCategory] = useState("");
  const [goalDeadline, setGoalDeadline] = useState<Date | undefined>();

  const categories = ["Faith", "Career/Professional Development", "Personal", "Health & Wellness", "Home/Family", "Business", "Finance"];

  return (
    <section id="goals" className="mb-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Goals</CardTitle>
          <CardDescription className="mb-4">Make your goals specific, measurable, achievable, and relevant</CardDescription>

          <div className="flex gap-2">
            <Select value={newCategory} onValueChange={(v) => setNewCategory(v)}>
              <SelectTrigger className="h-9 w-[180px] rounded-md" aria-label="Select category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Category</SelectLabel>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat.toLowerCase()}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Input placeholder="Goal" className="w-full" />
            <div className="flex w-full flex-col gap-3">
              <Popover open={!!goalDeadline} onOpenChange={(o) => !o && setGoalDeadline(undefined)}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal text-muted-foreground">
                    {goalDeadline ? formatISODate(goalDeadline) : "Select Deadline"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto overflow-hidden p-0">
                  <Calendar mode="single" selected={goalDeadline} onSelect={(d) => d && setGoalDeadline(d)} className="w-auto rounded-md border" />
                </PopoverContent>
              </Popover>
            </div>
            <Button size="icon" aria-label="Add goals" onClick={() => toast("Add goals feature coming soon!")}>
              <Plus />
            </Button>
          </div>
        </CardHeader>

        <CardContent></CardContent>
      </Card>
    </section>
  );
}
