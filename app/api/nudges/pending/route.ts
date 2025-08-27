import { NextResponse } from "next/server";
import { formatISODate } from "@/lib/date-utils";

import { collection, getDocs, query, where, documentId } from "firebase/firestore";
import { getUserIdFromRequest } from "@/lib/get-authenticated-user";
import { firestore } from "@/lib/firebase-client";

const chunk = <T>(arr: T[], size = 10): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

type EventRow = { id: string; remaining: number; habit: string };

export async function GET(req: Request) {
  try {
    const user = await getUserIdFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const today = formatISODate(new Date());

    const nudgesRef = collection(firestore, "users", user.uid, "nudge_events");
    const nudgesQ = query(nudgesRef, where("date", "==", today), where("status", "==", "pending"));
    const nudgesSnap = await getDocs(nudgesQ);

    if (nudgesSnap.empty) {
      return NextResponse.json<EventRow[]>([]);
    }

    const habitIds = Array.from(new Set(nudgesSnap.docs.map((d) => String((d.data() as any).habitId)).filter(Boolean)));

    const habitNameById = new Map<string, string>();

    for (const ids of chunk(habitIds, 10)) {
      const habitsRef = collection(firestore, "users", user.uid, "habits");
      const habitsQ = query(habitsRef, where(documentId(), "in", ids));
      const habitsSnap = await getDocs(habitsQ);
      habitsSnap.forEach((h) => {
        const name = (h.data() as any)?.name ?? "";
        habitNameById.set(h.id, name);
      });
    }

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
  } catch (e) {
    console.error("GET /api/nudges/pending", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
