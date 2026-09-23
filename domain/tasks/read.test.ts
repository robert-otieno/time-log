import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { OrganizationMember } from "@/domain/organizations/schemas";
import { listEligibleTaskAssignees } from "@/domain/tasks/read";

const stamp = { seconds: 1, nanoseconds: 0 };
const actor = {
  type: "user" as const,
  uid: "u1",
  email: "casey@example.com",
  emailVerified: true,
  displayName: "Casey",
};
const viewer: OrganizationMember = {
  userId: "u1",
  role: "admin",
  status: "active",
  clientId: null,
  joinedAt: stamp,
};
const members = [
  viewer,
  { userId: "u2", role: "member" as const, status: "active" as const, clientId: null, joinedAt: stamp },
  { userId: "u3", displayName: "No project access", role: "member" as const, status: "active" as const, clientId: null, joinedAt: stamp },
  { userId: "client", displayName: "Client User", role: "client" as const, status: "active" as const, clientId: "c1", joinedAt: stamp },
];

function environment() {
  const assignments: Record<string, Record<string, unknown>> = {
    "organizations/o1/projects/p1/projectMembers/u2": { status: "active" },
  };
  const db = {
    collection: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(async () => ({
          docs: members.map((member) => ({ data: () => member })),
        })),
      })),
    })),
    doc: vi.fn((path: string) => ({
      get: vi.fn(async () => ({
        exists: Boolean(assignments[path]),
        data: () => assignments[path],
      })),
    })),
  } as unknown as Firestore;
  const auth = {
    getUsers: vi.fn(async () => ({
      users: [{ uid: "u2", displayName: "Jordan Lee", email: "jordan@example.com" }],
      notFound: [],
    })),
  } as unknown as Pick<Auth, "getUsers">;
  return { db, auth };
}

describe("task assignee discovery", () => {
  it("returns named, project-eligible internal workspace members", async () => {
    const { db, auth } = environment();

    await expect(
      listEligibleTaskAssignees(actor, "o1", "p1", viewer, db, auth),
    ).resolves.toEqual([
      { id: "u1", name: "Casey", email: "casey@example.com" },
      { id: "u2", name: "Jordan Lee", email: "jordan@example.com" },
    ]);

    expect(auth.getUsers).toHaveBeenCalledWith([{ uid: "u2" }]);
  });
});
