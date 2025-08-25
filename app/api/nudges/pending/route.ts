import { NextResponse } from "next/server";
import { formatISODate } from "@/lib/date-utils";

import { collection, getDocs, query, where, documentId } from "firebase/firestore";
import { db } from "@/db";

// Firestore `in` operator accepts at most 10 values
const chunk = <T>(arr: T[], size = 10): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

type EventRow = { id: number; remaining: number; habit: string };

export async function GET() {
  const today = formatISODate(new Date());

  // 1) Load today's pending nudges
  const nudgesQ = query(collection(db, "nudge_events"), where("date", "==", today), where("status", "==", "pending"));
  const nudgesSnap = await getDocs(nudgesQ);

  if (nudgesSnap.empty) {
    return NextResponse.json<EventRow[]>([]);
  }

  // 2) Collect habit doc IDs (ensure string)
  const habitIds = Array.from(new Set(nudgesSnap.docs.map((d) => String((d.data() as any).habitId)).filter(Boolean)));

  // 3) Fetch habit docs in chunks via documentId() IN [...]
  const habitNameById = new Map<string, string>();

  for (const ids of chunk(habitIds, 10)) {
    const habitsQ = query(collection(db, "rhythm_tasks"), where(documentId(), "in", ids));
    const habitsSnap = await getDocs(habitsQ);
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
      id: Number(doc.id),
      remaining: data.remaining ?? 0,
      habit: habitNameById.get(hid) ?? "",
    };
  });

  return NextResponse.json(events);
}
