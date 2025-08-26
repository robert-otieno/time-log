import { NextResponse } from "next/server";
import { adminDb } from "@/db";
import { formatISODate } from "@/lib/date-utils";
import { isHabitDue } from "@/lib/habit-schedule";
import { collection, doc, getDocs, query, where } from "firebase/firestore";
import { getUserIdFromRequest } from "@/lib/get-authenticated-user";

const chunk = <T>(arr: T[], size = 10): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = formatISODate(new Date());

  // 1) Load all habits for the current user
  const ref = adminDb.collection("users").doc(userId).collection("rhythm_tasks");
  const habitsSnap = await ref.get();
  const allHabits = habitsSnap.docs.map((d) => ({ id: Number(d.id), ...(d.data() as any) }));

  // 2) Keep only habits due today (by schedule mask)
  const dueHabits = allHabits.filter((h) => isHabitDue(h.scheduleMask));

  // 3) Fetch today's completions in batches of 10 habitIds
  const habitIds = dueHabits.map((h) => h.id);
  const completionsByHabit = new Map<number, number>();

  for (const ids of chunk(habitIds, 10)) {
    // If you store habitId as a number in completions:
    const compsRef = adminDb.collection("users").doc(userId).collection("habit_completions");
    const compsQ = compsRef.where("habitId", "in", ids).where("date", "==", today);
    const compsSnap = await compsQ.get();
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
