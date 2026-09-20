import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { activeTimerPointerSchema, activeTimerSchema, timeEntrySchema, type ActiveTimer } from "@/domain/time/schemas";
import { getAdminDb } from "@/lib/firebase-admin";

export class TimeRepository {
  constructor(private readonly db: Firestore = getAdminDb()) {}

  activeTimerReference(organizationId: string, projectId: string, userId: string) {
    return this.db.doc(`organizations/${organizationId}/projects/${projectId}/activeTimers/${userId}`);
  }

  activeTimerPointerReference(userId: string) {
    return this.db.doc(`users/${userId}/runtime/activeTimer`);
  }

  timeEntriesCollection(organizationId: string, projectId: string) {
    return this.db.collection(`organizations/${organizationId}/projects/${projectId}/timeEntries`);
  }

  timeEntryReference(organizationId: string, projectId: string, entryId: string) {
    return this.db.doc(`organizations/${organizationId}/projects/${projectId}/timeEntries/${entryId}`);
  }

  async getActiveTimerPointer(userId: string) {
    const snapshot = await this.activeTimerPointerReference(userId).get();
    if (!snapshot.exists) return null;
    const pointer = activeTimerPointerSchema.parse(snapshot.data());
    if (pointer.userId !== userId) throw new Error("Active timer pointer owner mismatch");
    return pointer;
  }

  async getActiveTimer(userId: string): Promise<ActiveTimer | null> {
    const pointer = await this.getActiveTimerPointer(userId);
    if (!pointer) return null;
    const timerSnapshot = await this.activeTimerReference(pointer.organizationId, pointer.projectId, userId).get();
    if (!timerSnapshot.exists) throw new Error("Active timer pointer is stale");
    const timer = activeTimerSchema.parse(timerSnapshot.data());
    if (timer.userId !== userId || timer.organizationId !== pointer.organizationId || timer.projectId !== pointer.projectId) {
      throw new Error("Active timer pointer target mismatch");
    }
    return timer;
  }

  async listRecentEntries(organizationId: string, projectId: string, limit = 20) {
    const snapshot = await this.timeEntriesCollection(organizationId, projectId).orderBy("startedAt", "desc").limit(limit).get();
    return snapshot.docs.map((document) => timeEntrySchema.parse({ id: document.id, ...document.data() }));
  }
}
