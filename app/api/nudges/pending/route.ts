// import { NextResponse } from "next/server";
// import { formatISODate } from "@/lib/date-utils";

// import { collection, getDocs, query, where, documentId } from "firebase/firestore";
// import { firestore } from "@/lib/firebase-client";
// import { getCurrentUser } from "@/lib/auth";

// const chunk = <T>(arr: T[], size = 10): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

// type EventRow = { id: string; remaining: number; habit: string };

// export async function GET(req: Request) {
//   try {
//     const user = await getCurrentUser();
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }
//     const today = formatISODate(new Date());

//     const nudgesRef = collection(firestore, "users", user.uid, "nudge_events");
//     const nudgesQ = query(nudgesRef, where("date", "==", today), where("status", "==", "pending"));
//     const nudgesSnap = await getDocs(nudgesQ);

//     if (nudgesSnap.empty) {
//       return NextResponse.json<EventRow[]>([]);
//     }

//     const habitIds = Array.from(new Set(nudgesSnap.docs.map((d) => String((d.data() as any).habitId)).filter(Boolean)));

//     const habitNameById = new Map<string, string>();

//     for (const ids of chunk(habitIds, 10)) {
//       const habitsRef = collection(firestore, "users", user.uid, "habits");
//       const habitsQ = query(habitsRef, where(documentId(), "in", ids));
//       const habitsSnap = await getDocs(habitsQ);
//       habitsSnap.forEach((h) => {
//         const name = (h.data() as any)?.name ?? "";
//         habitNameById.set(h.id, name);
//       });
//     }

//     const events: EventRow[] = nudgesSnap.docs.map((doc) => {
//       const data = doc.data() as any;
//       const hid = String(data.habitId);
//       return {
//         id: doc.id,
//         remaining: data.remaining ?? 0,
//         habit: habitNameById.get(hid) ?? "",
//       };
//     });

//     return NextResponse.json(events);
//   } catch (e) {
//     console.error("GET /api/nudges/pending", e);
//     return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
//   }
// }
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getServerUser } from "@/lib/auth-server";
import { formatISODate } from "@/lib/date-utils";
import { isHabitDue } from "@/lib/habit-schedule";
import { FieldPath } from "firebase-admin/firestore";

export async function GET(req: Request) {
  try {
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = formatISODate(new Date());

    // 1) Try to read today's pending nudges for this user
    const nudgesCol = adminDb.collection("users").doc(user.uid).collection("nudge_events");
    let nudgesSnap = await nudgesCol
      .where("date", "==", today)
      .where("status", "==", "pending")
      .limit(10)
      .get();

    // 2) If none exist, compute and create them idempotently
    if (nudgesSnap.empty) {
      const habitsSnap = await adminDb.collection("users").doc(user.uid).collection("habits").get();
      const habits = habitsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const dueHabits = habits.filter((h) => isHabitDue(h.scheduleMask));

      if (dueHabits.length) {
        // Query today's completions for due habits in batches of 10 by documentId
        const ids: string[] = dueHabits.map((h) => `${h.id}:${today}`);
        const batches: string[][] = [];
        for (let i = 0; i < ids.length; i += 10) batches.push(ids.slice(i, i + 10));

        const valByHabit = new Map<string, number>();
        for (const b of batches) {
          const comps = await adminDb
            .collection("users")
            .doc(user.uid)
            .collection("habit_completions")
            .where(FieldPath.documentId(), "in", b)
            .get();
          comps.docs.forEach((doc) => {
            const [hid] = doc.id.split(":");
            const v = (doc.data() as any)?.value ?? 0;
            valByHabit.set(hid!, Number(v) || 0);
          });
        }

        const toCreate = dueHabits
          .map((h) => {
            const current = valByHabit.get(h.id) ?? 0;
            const target = Number(h.target ?? 1) || 1;
            const remaining = Math.max(0, target - current);
            return { habitId: h.id, remaining };
          })
          .filter((x) => x.remaining > 0);

        for (const { habitId, remaining } of toCreate) {
          const id = `${habitId}:${today}`;
          const ref = nudgesCol.doc(id);
          const exists = await ref.get();
          if (!exists.exists) {
            await ref.set({ habitId, date: today, remaining, status: "pending" });
          }
        }

        // Re-read created nudges
        nudgesSnap = await nudgesCol
          .where("date", "==", today)
          .where("status", "==", "pending")
          .limit(10)
          .get();
      }
    }

    if (nudgesSnap.empty) return NextResponse.json([]);

    const nudges = nudgesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const habitIds = Array.from(new Set(nudges.map((n) => String(n.habitId)).filter(Boolean)));

    // Join habit names (stored under user-scoped habits). Use FieldPath.documentId().
    const nameById = new Map<string, string>();
    for (let i = 0; i < habitIds.length; i += 10) {
      const ids = habitIds.slice(i, i + 10);
      const hs = await adminDb
        .collection("users")
        .doc(user.uid)
        .collection("habits")
        .where(FieldPath.documentId(), "in", ids)
        .get();
      hs.docs.forEach((h) => nameById.set(h.id, ((h.data() as any)?.name ?? "") as string));
    }

    const events = nudges.map((n) => ({
      id: n.id,
      remaining: n.remaining ?? 0,
      habit: nameById.get(String(n.habitId)) ?? "",
    }));

    return NextResponse.json(events);
  } catch (e) {
    console.error("GET /api/nudges/pending", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
