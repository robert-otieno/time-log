import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { toggleHabitCompletion } from "@/app/actions/goals";

const paramsSchema = z.object({ id: z.string().min(1) });
const bodySchema = z.object({
  date: z.string().min(1),
  value: z.number().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const parsedParams = paramsSchema.safeParse({ id });
    if (!parsedParams.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const body = await req.json();
    const parsedBody = bodySchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await toggleHabitCompletion(parsedParams.data.id, parsedBody.data.date, parsedBody.data.value);

    return NextResponse.json(result);
  } catch (e) {
    console.error("POST /api/habits/[id]/toggle", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
