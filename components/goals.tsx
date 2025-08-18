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
          <CardDescription>Make your goals specific, measurable, achievable, and relevant</CardDescription>
          <CardAction></CardAction>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-3">
            {/* Category
                    1. Career / Professional Development
                      Goal: (What improvement do you want to see in your office? A promotion etc.)
                    2. Personal Development 
                      Goal:(What book would you like to write; or content you'd like to produce in...)
                      Habit 1:
                    3. Health & Wellness
                    4. Home/Family
                     Goal: (What skills do you want your kids to develop in 2025)
                     Habit 1 - (think about how many hours a week you want your kids to practice the skill)
                     
                    */}

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
            {/* Goal */}
            <Input placeholder="Goal" className="w-full" />
            {/* Habit */}

            {/* Deadline */}
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
        </CardContent>
      </Card>
    </section>
  );
}
