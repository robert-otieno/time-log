import { firestore } from "@/lib/firebase-client";
import { getUserIdFromRequest } from "@/lib/get-authenticated-user";
import { doc, updateDoc } from "firebase/firestore";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserIdFromRequest();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status } = await req.json();

  if (status !== "acknowledged" && status !== "snoozed") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ref = doc(firestore, "users", user.uid, "nudge_events", params.id);
  await updateDoc(ref, { status });

  return NextResponse.json({ success: true });
}
