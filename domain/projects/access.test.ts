import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { getAccessibleProject, listAccessibleProjects } from "@/domain/projects/service";

const timestamp = { seconds: 1, nanoseconds: 0 };
const actor = { type: "user" as const, uid: "client-user", email: null, emailVerified: true, displayName: "Client" };
const project = { name: "Website", key: "WEB", description: null, clientId: "client-1", status: "archived", enabledTools: ["todos"], defaultVisibility: "internal", templateSource: null, createdBy: "admin", createdAt: timestamp, updatedBy: "admin", updatedAt: timestamp };

function projectReference(organizationId: string, id: string) {
  return { id, path: `organizations/${organizationId}/projects/${id}`, parent: { parent: { id: organizationId } } };
}

function clientDatabase(options: { assigned?: boolean; membershipStatus?: "active" | "suspended"; role?: "client" | "member"; projectRole?: "admin" | "member" } = {}) {
  const assigned = options.assigned ?? true;
  const role = options.role ?? "client";
  const membership = { userId: actor.uid, role, status: options.membershipStatus ?? "active", clientId: role === "client" ? "client-1" : null, joinedAt: options.membershipStatus === "suspended" ? null : timestamp };
  const projectRef = projectReference("org-1", "project-1");
  const otherProjectRef = projectReference("org-2", "other-project");
  const assignment = { userId: actor.uid, projectRole: options.projectRole ?? "member", status: "active", assignedBy: "admin", assignedAt: timestamp, removedAt: null };
  const values: Record<string, Record<string, unknown>> = {
    [`organizations/org-1/members/${actor.uid}`]: membership,
    "organizations/org-1/projects/project-1": project,
    ...(assigned ? { [`organizations/org-1/projects/project-1/projectMembers/${actor.uid}`]: assignment } : {}),
  };
  const doc = vi.fn((path: string) => ({ path, id: path.split("/").at(-1), get: vi.fn(async () => ({ exists: Boolean(values[path]), id: path.split("/").at(-1), data: () => values[path] })) }));
  const assignmentDocs = assigned ? [
    { ref: { parent: { parent: projectRef } } },
    { ref: { parent: { parent: otherProjectRef } } },
  ] : [];
  const assignmentQuery = { get: vi.fn(async () => ({ docs: assignmentDocs })) };
  const query = { where: vi.fn(() => query) } as { where: ReturnType<typeof vi.fn>; get?: ReturnType<typeof vi.fn> };
  query.get = assignmentQuery.get;
  const db = {
    doc,
    collectionGroup: vi.fn(() => query),
    getAll: vi.fn(async (...references: Array<{ id: string }>) => references.map((reference) => ({ exists: reference.id === "project-1", id: reference.id, data: () => project }))),
  } as unknown as Firestore;
  return db;
}

describe("client project access", () => {
  it("lists only active assignments inside the selected organization", async () => {
    const db = clientDatabase();
    const projects = await listAccessibleProjects(actor, "org-1", db);
    expect(projects?.map(({ id, status }) => ({ id, status }))).toEqual([{ id: "project-1", status: "archived" }]);
    expect(db.getAll).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list without project assignment and denies suspended clients", async () => {
    await expect(listAccessibleProjects(actor, "org-1", clientDatabase({ assigned: false }))).resolves.toEqual([]);
    await expect(listAccessibleProjects(actor, "org-1", clientDatabase({ membershipStatus: "suspended" }))).resolves.toBeNull();
  });

  it("opens an assigned project in client mode and rejects a direct unassigned URL", async () => {
    await expect(getAccessibleProject(actor, "org-1", "project-1", clientDatabase())).resolves.toMatchObject({ role: "client", project: { id: "project-1" } });
    await expect(getAccessibleProject(actor, "org-1", "project-1", clientDatabase({ assigned: false }))).resolves.toBeNull();
  });

  it("discovers member projects from assignments without scanning every project", async () => {
    const db = clientDatabase({ role: "member" });
    await expect(listAccessibleProjects(actor, "org-1", db)).resolves.toHaveLength(1);
    expect(db.collectionGroup).toHaveBeenCalledWith("projectMembers");
    expect(db.getAll).toHaveBeenCalledTimes(1);
  });

  it("identifies project management from the assignment without widening discovery", async () => {
    await expect(getAccessibleProject(actor, "org-1", "project-1", clientDatabase({ role: "member", projectRole: "admin" }))).resolves.toMatchObject({
      role: "member",
      canManageProject: true,
      project: { id: "project-1" },
    });
    await expect(getAccessibleProject(actor, "org-1", "project-1", clientDatabase({ role: "member" }))).resolves.toMatchObject({ canManageProject: false });
  });
});
