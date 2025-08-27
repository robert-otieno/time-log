import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addHabit } from "@/app/actions/goals";

const addHabitSchema = z.object({
  goalId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["checkbox", "counter"]).optional(),
  target: z.number().optional(),
  scheduleMask: z.string().length(7).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = addHabitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const habit = await addHabit(parsed.data);
    return NextResponse.json(habit);
  } catch (e) {
    console.error("POST /api/habits", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
