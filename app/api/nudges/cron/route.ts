import { NextResponse } from "next/server";
import { formatISODate } from "@/lib/date-utils";
import { isHabitDue } from "@/lib/habit-schedule";
import { collection, doc, documentId, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { getUserIdFromRequest } from "@/lib/get-authenticated-user";
import { firestore } from "@/lib/firebase-client";

const chunk = <T>(arr: T[], size = 10): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const expected = process.env.CRON_SECRET;
    if (expected && authHeader !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserIdFromRequest();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = formatISODate(new Date());

    const habitsRef = collection(firestore, "users", user.uid, "habits");
    const habitsSnap = await getDocs(habitsRef);
    const allHabits = habitsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    const dueHabits = allHabits.filter((h) => isHabitDue(h.scheduleMask));
    if (dueHabits.length === 0) {
      return NextResponse.json({ created: [] });
    }

    const completionDocIds = dueHabits.map((h) => `${h.id}:${today}`);
    const completionsRef = collection(firestore, "users", user.uid, "habit_completions");

    const valueByHabitId = new Map<string, number>();
    for (const ids of chunk(completionDocIds, 10)) {
      const compsSnap = await getDocs(query(completionsRef, where(documentId(), "in", ids)));
      compsSnap.forEach((doc) => {
        const habitId = doc.id.split(":")[0]!;
        const val = (doc.data() as any)?.value ?? 0;
        valueByHabitId.set(habitId, Number(val) || 0);
      });
    }

    const created = dueHabits
      .map((h) => {
        const current = valueByHabitId.get(h.id) ?? 0;
        const target = h.target ?? 1;
        const remaining = Math.max(0, target - current);
        return { habitId: h.id, remaining };
      })
      .filter((r) => r.remaining > 0);

const nudgesRef = collection(firestore, "users", user.uid, "nudge_events");
    const createdIds: string[] = [];

    for (const { habitId, remaining } of created) {
      const id = `${habitId}:${today}`;
      const nudgeDocRef = doc(nudgesRef, id);
      const existing = await getDoc(nudgeDocRef);
      if (existing.exists()) continue;

      await setDoc(nudgeDocRef, {
        habitId,
        date: today,
        remaining,
        status: "pending",
      });
      createdIds.push(id);
    }

    return NextResponse.json({ created: createdIds });  } catch (e) {
    console.error("POST /api/nudges/cron", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
