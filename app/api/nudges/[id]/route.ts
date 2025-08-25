import { auth, db } from "@/db";
import { collection, doc, updateDoc } from "firebase/firestore";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { status } = await req.json();
  if (status !== "acknowledged" && status !== "snoozed") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const ref = doc(db, "users", auth.currentUser!.uid, "nudge_events", params.id);
  await updateDoc(ref, { status });
  return NextResponse.json({ success: true });
}
