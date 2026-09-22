import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { isClientCapableTool, listAvailableClientTools } from "@/domain/projects/client-tools";

function database(collectionStates: Record<string, boolean>) {
  const get = vi.fn(async (path: string) => ({ empty: !collectionStates[path] }));
  const db = {
    collection: vi.fn((path: string) => {
      const chain = { where: vi.fn(), limit: vi.fn(() => ({ get: () => get(path) })) };
      chain.where.mockReturnValue(chain);
      return chain;
    }),
  } as unknown as Firestore;
  return { db, get };
}

describe("client project tool availability", () => {
  it("treats only implemented client-safe repositories as client capable", () => {
    expect(isClientCapableTool("todos")).toBe(true);
    expect(isClientCapableTool("time")).toBe(true);
    expect(isClientCapableTool("docs")).toBe(false);
    expect(isClientCapableTool("messages")).toBe(true);
    expect(isClientCapableTool("chat")).toBe(false);
  });

  it("shows a client-capable tool only when client-visible content exists", async () => {
    const path = "organizations/org-1/projects/project-1/tasks";
    const { db } = database({ [path]: true });
    await expect(listAvailableClientTools("org-1", "project-1", ["todos", "time"], db)).resolves.toEqual(["todos"]);
  });

  it("does not query unsupported enabled tools", async () => {
    const { db, get } = database({});
    await expect(listAvailableClientTools("org-1", "project-1", ["chat"], db)).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it("shows time only when an approved entry exists", async () => {
    const path = "organizations/org-1/projects/project-1/timeEntries";
    const { db } = database({ [path]: true });
    await expect(listAvailableClientTools("org-1", "project-1", ["time"], db)).resolves.toEqual(["time"]);
  });

  it("keeps docs unavailable while Storage is disabled", async () => {
    const path = "organizations/org-1/projects/project-1/files";
    const { db } = database({ [path]: true });
    await expect(listAvailableClientTools("org-1", "project-1", ["docs"], db)).resolves.toEqual([]);
  });
});
