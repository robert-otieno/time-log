import { adminDb } from "@/db";
import { getUserIdFromRequest } from "@/lib/get-authenticated-user";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status } = await req.json();

  if (status !== "acknowledged" && status !== "snoozed") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ref = adminDb.collection("users").doc(userId).collection("nudge_events").doc(params.id);
  await ref.update({ status });

  return NextResponse.json({ success: true });
}
