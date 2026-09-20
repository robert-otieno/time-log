import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { activeTimerPointerSchema, activeTimerSchema, type ActiveTimer } from "@/domain/time/schemas";
import { getAdminDb } from "@/lib/firebase-admin";

export class TimeRepository {
  constructor(private readonly db: Firestore = getAdminDb()) {}

  activeTimerReference(organizationId: string, projectId: string, userId: string) {
    return this.db.doc(`organizations/${organizationId}/projects/${projectId}/activeTimers/${userId}`);
  }

  activeTimerPointerReference(userId: string) {
    return this.db.doc(`users/${userId}/runtime/activeTimer`);
  }

  async getActiveTimer(userId: string): Promise<ActiveTimer | null> {
    const pointerSnapshot = await this.activeTimerPointerReference(userId).get();
    if (!pointerSnapshot.exists) return null;
    const pointer = activeTimerPointerSchema.parse(pointerSnapshot.data());
    if (pointer.userId !== userId) throw new Error("Active timer pointer owner mismatch");
    const timerSnapshot = await this.activeTimerReference(pointer.organizationId, pointer.projectId, userId).get();
    if (!timerSnapshot.exists) throw new Error("Active timer pointer is stale");
    const timer = activeTimerSchema.parse(timerSnapshot.data());
    if (timer.userId !== userId || timer.organizationId !== pointer.organizationId || timer.projectId !== pointer.projectId) {
      throw new Error("Active timer pointer target mismatch");
    }
    return timer;
  }
}
