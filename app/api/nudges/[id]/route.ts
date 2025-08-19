import { NextResponse } from "next/server";
import { db } from "@/db";
import { nudgeEvents } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { status } = await req.json();
  if (status !== "acknowledged" && status !== "snoozed") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  await db
    .update(nudgeEvents)
    .set({ status })
    .where(eq(nudgeEvents.id, Number(params.id)))
    .run();
  return NextResponse.json({ success: true });
}
