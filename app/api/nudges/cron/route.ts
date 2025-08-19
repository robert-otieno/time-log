import { NextResponse } from "next/server";
import { db } from "@/db";
import { rhythmTasks, habitCompletions, nudgeEvents } from "@/db/schema";
import { formatISODate } from "@/lib/date-utils";
import { isHabitDue } from "@/lib/habit-schedule";
import { and, eq } from "drizzle-orm";

export async function GET() {
  const today = formatISODate(new Date());
  const habits = await db.select().from(rhythmTasks);
  const created: { habitId: number; remaining: number }[] = [];

  for (const h of habits) {
    if (!isHabitDue(h.scheduleMask)) continue;
    const completion = await db
      .select({ value: habitCompletions.value })
      .from(habitCompletions)
      .where(and(eq(habitCompletions.habitId, h.id), eq(habitCompletions.date, today)));
    const value = completion.length > 0 ? completion[0].value : 0;
    if (value >= h.target) continue;
    const existing = await db
      .select()
      .from(nudgeEvents)
      .where(and(eq(nudgeEvents.habitId, h.id), eq(nudgeEvents.date, today)));
    if (existing.length === 0) {
      await db
        .insert(nudgeEvents)
        .values({
          habitId: h.id,
          date: today,
          remaining: h.target - value,
          status: "pending",
          createdAt: new Date().toISOString(),
        })
        .run();
      created.push({ habitId: h.id, remaining: h.target - value });
    }
  }

  return NextResponse.json({ created });
}
