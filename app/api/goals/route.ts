import "server-only";
import { NextResponse } from "next/server";
import { createGoal, getGoalsWithHabits } from "@/app/actions/goals";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date query param required" }, { status: 400 });
  }
  try {
    const goals = await getGoalsWithHabits(date);
    return NextResponse.json(goals);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const goal = await createGoal(body);
    return NextResponse.json(goal);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
