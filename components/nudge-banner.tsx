// "use client";

// import { useEffect, useState } from "react";

// interface Nudge {
//   id: string;
//   habit: string;
//   remaining: number;
// }

// export default function NudgeBanner() {
//   const [nudge, setNudge] = useState<Nudge | null>(null);

//   useEffect(() => {
//     fetch("/api/nudges/pending")
//       .then((res) => res.json())
//       .then((data) => {
//         if (Array.isArray(data) && data.length > 0) {
//           setNudge(data[0]);
//         }
//       })
//       .catch(() => {});
//   }, []);

//   if (!nudge) return null;

//   const handle = async (status: "acknowledged" | "snoozed") => {
//     await fetch(`/api/nudges/${encodeURIComponent(nudge.id)}`, {
//       method: "PATCH",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ status }),
//     });
//     setNudge(null);
//   };

//   return (
//     <div className="bg-amber-50 dark:bg-amber-900 text-amber-900 dark:text-amber-100 p-4 text-center text-sm">
//       <span className="mr-4">
//         {nudge.habit}: Finish {nudge.remaining} more.
//       </span>
//       <button className="underline mr-2" onClick={() => handle("acknowledged")}>
//         Got it
//       </button>
//       <button className="underline" onClick={() => handle("snoozed")}>
//         Snooze
//       </button>
//     </div>
//   );
// }

"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { clientAuth } from "@/lib/firebase-client";

interface Nudge {
  id: string;
  habit: string;
  remaining: number;
}

export default function NudgeBanner() {
  const [nudge, setNudge] = useState<Nudge | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(clientAuth, async (u) => {
      if (!u) return; // not signed in
      const token = await u.getIdToken();

      const res = await fetch("/api/nudges/pending", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) setNudge(data[0]);
    });
    return () => unsub();
  }, []);

  if (!nudge) return null;

  const handle = async (status: "acknowledged" | "snoozed") => {
    const u = getAuth().currentUser;
    const token = u ? await u.getIdToken() : undefined;
    await fetch(`/api/nudges/${encodeURIComponent(nudge.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ status }),
    });
    setNudge(null);
  };

  return (
    <div className='bg-amber-50 dark:bg-amber-900 text-amber-900 dark:text-amber-100 p-4 text-center text-sm'>
      <span className='mr-4'>
        {nudge.habit}: Finish {nudge.remaining} more.
      </span>
      <button className='underline mr-2' onClick={() => handle("acknowledged")}>
        Got it
      </button>
      <button className='underline' onClick={() => handle("snoozed")}>
        Snooze
      </button>
    </div>
  );
}
