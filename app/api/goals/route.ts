import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createGoal, getGoalsWithHabits } from "@/app/actions/goals";

const getGoalsSchema = z.object({
  date: z.string().min(1),
});

const createGoalSchema = z.object({
  category: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  targetDate: z.string().nullish(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = getGoalsSchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const goals = await getGoalsWithHabits(parsed.data.date);

    return NextResponse.json(goals);
  } catch (e) {
    console.error("GET /api/goals", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createGoalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const goal = await createGoal(parsed.data);

    return NextResponse.json(goal);
  } catch (e) {
    console.error("POST /api/goals", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
