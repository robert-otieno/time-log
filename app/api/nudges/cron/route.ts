import { NextResponse } from "next/server";
import { auth, db } from "@/db";
import { formatISODate } from "@/lib/date-utils";
import { isHabitDue } from "@/lib/habit-schedule";
import { collection, doc, getDocs, query, where } from "firebase/firestore";
import { verifyIdToken } from "@/lib/firebase-admin";

const chunk = <T>(arr: T[], size = 10): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader || undefined;
  const decoded = await verifyIdToken(token);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = decoded.uid;
  const today = formatISODate(new Date());

  // 1) Load all habits for the current user
  const habitsSnap = await getDocs(collection(doc(db, "users", uid), "rhythm_tasks"));
  const allHabits = habitsSnap.docs.map((d) => ({ id: Number(d.id), ...(d.data() as any) }));

  // 2) Keep only habits due today (by schedule mask)
  const dueHabits = allHabits.filter((h) => isHabitDue(h.scheduleMask));

  // 3) Fetch today's completions in batches of 10 habitIds
  const habitIds = dueHabits.map((h) => h.id);
  const completionsByHabit = new Map<number, number>();

  for (const ids of chunk(habitIds, 10)) {
    // If you store habitId as a number in completions:
    const compsQ = query(collection(doc(db, "users", uid), "habit_completions"), where("habitId", "in", ids), where("date", "==", today));
    const compsSnap = await getDocs(compsQ);
    compsSnap.forEach((doc) => {
      const c = doc.data() as { habitId: number; date: string; value: number };
      completionsByHabit.set(c.habitId, c.value ?? 0);
    });
  }

  // 4) Build remaining list
  const created: { habitId: number; remaining: number }[] = [];
  for (const h of dueHabits) {
    const current = completionsByHabit.get(h.id) ?? 0;
    const remaining = Math.max(0, (h.target ?? 1) - current);
    if (remaining > 0) {
      created.push({ habitId: h.id, remaining });
    }
  }

  return NextResponse.json({ created });
}
