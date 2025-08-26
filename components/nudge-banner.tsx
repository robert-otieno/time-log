"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";

interface Nudge {
  id: number;
  habit: string;
  remaining: number;
}

export default function NudgeBanner() {
  const [nudge, setNudge] = useState<Nudge | null>(null);

  useEffect(() => {
    fetchWithAuth("/api/nudges/pending")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setNudge(data[0]);
        }
      })
      .catch(() => {});
  }, []);

  if (!nudge) return null;

  const handle = async (status: "acknowledged" | "snoozed") => {
    await fetchWithAuth(`/api/nudges/${nudge.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setNudge(null);
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-900 text-amber-900 dark:text-amber-100 p-4 text-center text-sm">
      <span className="mr-4">
        {nudge.habit}: Finish {nudge.remaining} more.
      </span>
      <button className="underline mr-2" onClick={() => handle("acknowledged")}>
        Got it
      </button>
      <button className="underline" onClick={() => handle("snoozed")}>
        Snooze
      </button>
    </div>
  );
}
