import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { TaskRepository } from "@/domain/tasks/repository";

function database() {
  const get = vi.fn(async () => ({ docs: [] }));
  const chain = { where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), get };
  chain.where.mockReturnValue(chain); chain.orderBy.mockReturnValue(chain); chain.limit.mockReturnValue(chain);
  const db = { collection: vi.fn(() => chain) } as unknown as Firestore;
  return { db, chain, get };
}

describe("task repository", () => {
  it("does not issue a query for denied access", async () => {
    const env = database(); await expect(new TaskRepository(env.db).list("o1", "p1", {}, { kind: "deny" })).resolves.toEqual([]); expect(env.db.collection).not.toHaveBeenCalled();
  });
  it("applies client visibility and archive filters before bounded ordering", async () => {
    const env = database(); await new TaskRepository(env.db).list("o1", "p1", { limit: 25 }, { kind: "visibility", visibility: "client-visible" });
    expect(env.chain.where).toHaveBeenCalledWith("archivedAt", "==", null); expect(env.chain.where).toHaveBeenCalledWith("visibility", "==", "client-visible"); expect(env.chain.orderBy).toHaveBeenCalledWith("sortOrder", "asc"); expect(env.chain.limit).toHaveBeenCalledWith(25);
  });
});
