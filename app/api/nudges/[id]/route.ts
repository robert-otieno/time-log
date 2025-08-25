import { db } from "@/db";
import { verifyIdToken } from "@/lib/firebase-admin";
import { doc, updateDoc } from "firebase/firestore";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader || undefined;
  const decoded = await verifyIdToken(token);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { status } = await req.json();
  if (status !== "acknowledged" && status !== "snoozed") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const ref = doc(db, "users", decoded.uid, "nudge_events", params.id);
  await updateDoc(ref, { status });
  return NextResponse.json({ success: true });
}
