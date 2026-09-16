import { NextResponse } from "next/server";
import { formatISODate } from "@/lib/date-utils";
import { isHabitDue } from "@/lib/habit-schedule";
import { adminDb } from "@/lib/firebase-admin";
import { getServerUser } from "@/lib/auth-server";
import { FieldPath } from "firebase-admin/firestore";

const chunk = <T>(arr: T[], size = 10): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );

export async function POST(req: Request) {
  try {
    // Require a valid Firebase ID token (client or server can call this)
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = formatISODate(new Date());

    const habitsSnap = await adminDb.collection("users").doc(user.uid).collection("habits").get();
    const allHabits = habitsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const dueHabits = allHabits.filter((h) => isHabitDue(h.scheduleMask));
    if (dueHabits.length === 0) return NextResponse.json({ created: [] });

    // Read today's completions in batches of 10 by documentId
    const completionDocIds = dueHabits.map((h) => `${h.id}:${today}`);
    const valueByHabitId = new Map<string, number>();
    for (let i = 0; i < completionDocIds.length; i += 10) {
      const ids = completionDocIds.slice(i, i + 10);
      const compsSnap = await adminDb
        .collection("users")
        .doc(user.uid)
        .collection("habit_completions")
        .where(FieldPath.documentId(), "in", ids)
        .get();
      compsSnap.forEach((doc) => {
        const habitId = doc.id.split(":")[0]!;
        const val = (doc.data() as any)?.value ?? 0;
        valueByHabitId.set(habitId, Number(val) || 0);
      });
    }

    const toCreate = dueHabits
      .map((h) => {
        const current = valueByHabitId.get(h.id) ?? 0;
        const target = Number(h.target ?? 1) || 1;
        const remaining = Math.max(0, target - current);
        return { habitId: h.id, remaining };
      })
      .filter((r) => r.remaining > 0);

    const nudgesCol = adminDb.collection("users").doc(user.uid).collection("nudge_events");
    const createdIds: string[] = [];
    for (const { habitId, remaining } of toCreate) {
      const id = `${habitId}:${today}`;
      const ref = nudgesCol.doc(id);
      const existing = await ref.get();
      if (existing.exists) continue;
      await ref.set({ habitId, date: today, remaining, status: "pending" });
      createdIds.push(id);
    }

    return NextResponse.json({ created: createdIds });
  } catch (e) {
    console.error("POST /api/nudges/cron", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
