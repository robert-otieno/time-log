import { db } from "@/db";
import { verifyToken } from "@/lib/verify-token";
import { doc, updateDoc } from "firebase/firestore";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const authHeader = req.headers.get("authorization");
  const cookieToken = (await cookies()).get("token")?.value;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;
  const decoded = await verifyToken(token);
  if (!decoded?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { status } = await req.json();
  if (status !== "acknowledged" && status !== "snoozed") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const ref = doc(db, "users", decoded.user_id, "nudge_events", params.id);
  await updateDoc(ref, { status });
  return NextResponse.json({ success: true });
}
