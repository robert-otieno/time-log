import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { isClientCapableTool, listAvailableClientTools } from "@/domain/projects/client-tools";

function database(collectionStates: Record<string, boolean>) {
  const get = vi.fn(async () => ({ empty: !collectionStates[currentPath] }));
  let currentPath = "";
  const db = {
    collection: vi.fn((path: string) => {
      currentPath = path;
      return { where: vi.fn(() => ({ limit: vi.fn(() => ({ get })) })) };
    }),
  } as unknown as Firestore;
  return { db, get };
}

describe("client project tool availability", () => {
  it("treats only implemented client-safe repositories as client capable", () => {
    expect(isClientCapableTool("todos")).toBe(true);
    expect(isClientCapableTool("time")).toBe(false);
    expect(isClientCapableTool("chat")).toBe(false);
  });

  it("shows a client-capable tool only when client-visible content exists", async () => {
    const path = "organizations/org-1/projects/project-1/tasks";
    const { db } = database({ [path]: true });
    await expect(listAvailableClientTools("org-1", "project-1", ["todos", "time"], db)).resolves.toEqual(["todos"]);
  });

  it("does not query unsupported enabled tools", async () => {
    const { db, get } = database({});
    await expect(listAvailableClientTools("org-1", "project-1", ["time", "chat"], db)).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

