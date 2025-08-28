import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteHabit } from "@/app/actions/goals";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const parsed = paramsSchema.safeParse({ id });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await deleteHabit(parsed.data.id);
    return NextResponse.json(result);
  } catch (e) {
    console.error("DELETE /api/habits/[id]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
