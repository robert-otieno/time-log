import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  correctTimeEntry: vi.fn(),
  createManualTimeEntry: vi.fn(),
  getActiveOrganizationId: vi.fn(),
  getSessionActor: vi.fn(),
  pauseTimerForInactivity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/domain/time/service", () => ({
  correctTimeEntry: mocks.correctTimeEntry,
  createManualTimeEntry: mocks.createManualTimeEntry,
  getActiveTimer: vi.fn(),
  pauseTimerForInactivity: mocks.pauseTimerForInactivity,
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
  trackedTimerSeconds: (timer: { accumulatedSeconds: number }) => timer.accumulatedSeconds,
}));
vi.mock("@/lib/server-session", () => ({
  getActiveOrganizationId: mocks.getActiveOrganizationId,
  getSessionActor: mocks.getSessionActor,
}));
vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => ({
    doc: (path: string) => ({
      get: async () => ({
        data: () => path.endsWith("/task-1") ? { title: "Draft" } : { name: "Site", key: "SITE" },
      }),
    }),
  }),
}));

import {
  correctTimeEntryAction,
  createManualTimeEntryAction,
  pauseTimerForInactivityAction,
} from "@/app/(app)/timer-actions";

const actor = {
  type: "user" as const,
  uid: "u1",
  email: null,
  emailVerified: true,
  displayName: "Casey",
};

const entry = (id: string, taskId: string | null = "task-1") => ({
  id,
  taskId,
  userId: "u1",
  source: "manual" as const,
  startedAt: { seconds: 1_795_923_600, nanoseconds: 0 },
  endedAt: { seconds: 1_795_927_200, nanoseconds: 0 },
  durationSeconds: 3600,
  note: null,
  billable: false,
  clientReportingStatus: "internal" as const,
  correctionCount: 0,
});

describe("time entry actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionActor.mockResolvedValue(actor);
    mocks.getActiveOrganizationId.mockResolvedValue("o1");
  });

  it("removes the routing project id before correcting an entry", async () => {
    mocks.correctTimeEntry.mockResolvedValue(entry("entry-1"));

    await expect(
      correctTimeEntryAction({
        projectId: "p1",
        entryId: "entry-1",
        billable: true,
      }),
    ).resolves.toMatchObject({ ok: true, entry: { id: "entry-1", taskTitle: "Draft", durationSeconds: 3600 } });

    expect(mocks.correctTimeEntry).toHaveBeenCalledWith(
      actor,
      "o1",
      "p1",
      { entryId: "entry-1", billable: true },
      expect.any(Object),
    );
  });

  it("removes the routing project id before creating a manual entry", async () => {
    mocks.createManualTimeEntry.mockResolvedValue(entry("entry-2"));
    const command = {
      taskId: "task-1",
      startedAt: "2026-09-22T08:00:00.000Z",
      endedAt: "2026-09-22T09:00:00.000Z",
      note: null,
      billable: false,
      clientReportingStatus: "internal" as const,
    };

    await expect(
      createManualTimeEntryAction({ projectId: "p1", ...command }),
    ).resolves.toMatchObject({ ok: true, entry: { id: "entry-2", taskTitle: "Draft", durationSeconds: 3600 } });

    expect(mocks.createManualTimeEntry).toHaveBeenCalledWith(
      actor,
      "o1",
      "p1",
      command,
      expect.any(Object),
    );
  });

  it("validates and forwards an inactivity pause instant", async () => {
    mocks.pauseTimerForInactivity.mockResolvedValue({
      userId: "u1", organizationId: "o1", projectId: "p1", taskId: "task-1",
      startedAt: { seconds: 1, nanoseconds: 0 }, note: null, state: "paused",
      accumulatedSeconds: 120, currentSegmentStartedAt: null, segments: [],
      pausedAt: { seconds: 121, nanoseconds: 0 }, pauseReason: "inactivity",
    });

    const result = await pauseTimerForInactivityAction({ effectiveAt: "2026-09-23T10:00:00.000Z" });

    expect(result).toMatchObject({ ok: true, timer: { state: "paused", elapsedSeconds: 120, pauseReason: "inactivity" } });
    expect(mocks.pauseTimerForInactivity).toHaveBeenCalledWith(actor, "2026-09-23T10:00:00.000Z", expect.any(Object));
  });
});
