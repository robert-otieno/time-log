import { NextResponse } from "next/server";
import { formatISODate } from "@/lib/date-utils";

import { collection, getDocs, query, where, documentId, doc } from "firebase/firestore";
import { adminDb } from "@/db";
import { getUserIdFromRequest } from "@/lib/get-authenticated-user";

// Firestore `in` operator accepts at most 10 values
const chunk = <T>(arr: T[], size = 10): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

type EventRow = { id: string; remaining: number; habit: string };

export async function GET(req: Request) {
  // 0) Verify user auth
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const today = formatISODate(new Date());

  // 1) Load today's pending nudges for the current user
  const nudgesRef = adminDb.collection("users").doc(userId).collection("nudge_events");
  const nudgesQ = nudgesRef.where("date", "==", today).where("status", "==", "pending");
  const nudgesSnap = await nudgesQ.get();

  if (nudgesSnap.empty) {
    return NextResponse.json<EventRow[]>([]);
  }

  // 2) Collect habit doc IDs (ensure string)
  const habitIds = Array.from(new Set(nudgesSnap.docs.map((d) => String((d.data() as any).habitId)).filter(Boolean)));

  // 3) Fetch habit docs in chunks via documentId() IN [...]
  const habitNameById = new Map<string, string>();

  for (const ids of chunk(habitIds, 10)) {
    const habitsRef = adminDb.collection("users").doc(userId).collection("rhythm_tasks");
    const habitsQ = habitsRef.where(documentId(), "in", ids);
    const habitsSnap = await habitsQ.get();
    habitsSnap.forEach((h) => {
      const name = (h.data() as any)?.name ?? "";
      habitNameById.set(h.id, name);
    });
  }

  // 4) Build response rows (no extra reads)
  const events: EventRow[] = nudgesSnap.docs.map((doc) => {
    const data = doc.data() as any;
    const hid = String(data.habitId);
    return {
      id: doc.id,
      remaining: data.remaining ?? 0,
      habit: habitNameById.get(hid) ?? "",
    };
  });

  return NextResponse.json(events);
}
