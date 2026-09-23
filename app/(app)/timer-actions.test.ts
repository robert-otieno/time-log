import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  correctTimeEntry: vi.fn(),
  createManualTimeEntry: vi.fn(),
  getActiveOrganizationId: vi.fn(),
  getSessionActor: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/domain/time/service", () => ({
  correctTimeEntry: mocks.correctTimeEntry,
  createManualTimeEntry: mocks.createManualTimeEntry,
  getActiveTimer: vi.fn(),
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
}));
vi.mock("@/lib/server-session", () => ({
  getActiveOrganizationId: mocks.getActiveOrganizationId,
  getSessionActor: mocks.getSessionActor,
}));

import {
  correctTimeEntryAction,
  createManualTimeEntryAction,
} from "@/app/(app)/timer-actions";

const actor = {
  type: "user" as const,
  uid: "u1",
  email: null,
  emailVerified: true,
  displayName: "Casey",
};

describe("time entry actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionActor.mockResolvedValue(actor);
    mocks.getActiveOrganizationId.mockResolvedValue("o1");
  });

  it("removes the routing project id before correcting an entry", async () => {
    mocks.correctTimeEntry.mockResolvedValue({ id: "entry-1" });

    await expect(
      correctTimeEntryAction({
        projectId: "p1",
        entryId: "entry-1",
        billable: true,
      }),
    ).resolves.toEqual({ ok: true, entryId: "entry-1" });

    expect(mocks.correctTimeEntry).toHaveBeenCalledWith(
      actor,
      "o1",
      "p1",
      { entryId: "entry-1", billable: true },
      expect.any(Object),
    );
  });

  it("removes the routing project id before creating a manual entry", async () => {
    mocks.createManualTimeEntry.mockResolvedValue({ id: "entry-2" });
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
    ).resolves.toEqual({ ok: true, entryId: "entry-2" });

    expect(mocks.createManualTimeEntry).toHaveBeenCalledWith(
      actor,
      "o1",
      "p1",
      command,
      expect.any(Object),
    );
  });
});
