import { db } from "@/db";
import { getUserIdFromRequest } from "@/lib/get-authenticated-user";
import { doc, updateDoc } from "firebase/firestore";
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
  const ref = doc(db, "users", userId, "nudge_events", params.id);
  await updateDoc(ref, { status });
  return NextResponse.json({ success: true });
}
