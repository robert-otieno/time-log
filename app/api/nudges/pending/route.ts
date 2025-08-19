import { NextResponse } from "next/server";
import { db } from "@/db";
import { nudgeEvents, rhythmTasks } from "@/db/schema";
import { formatISODate } from "@/lib/date-utils";
import { and, eq } from "drizzle-orm";

export async function GET() {
  const today = formatISODate(new Date());
  const events = await db
    .select({
      id: nudgeEvents.id,
      remaining: nudgeEvents.remaining,
      habit: rhythmTasks.name,
    })
    .from(nudgeEvents)
    .innerJoin(rhythmTasks, eq(nudgeEvents.habitId, rhythmTasks.id))
    .where(and(eq(nudgeEvents.date, today), eq(nudgeEvents.status, "pending")));
  return NextResponse.json(events);
}
