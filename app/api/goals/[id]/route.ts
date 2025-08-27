import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteGoal } from "@/app/actions/goals";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const result = await deleteGoal(parsed.data.id);

    return NextResponse.json(result);
  } catch (e) {
    console.error("DELETE /api/goals/[id]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
