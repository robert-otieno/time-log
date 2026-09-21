import type { Firestore, Transaction } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { AuditWriter } from "@/domain/audit/command";
import { changeMemberRole, changeProjectAssignment, updateOrganizationSettings } from "@/domain/admin/service";

const actor = { type: "user" as const, uid: "admin-1", email: null, emailVerified: true, displayName: "Admin" };
const correlation = { requestId: "00000000-0000-4000-8000-000000000001", runId: null };
const stamp = { seconds: 100, nanoseconds: 0 };
const admin = { userId: "admin-1", email: null, displayName: "Admin", role: "admin", status: "active", clientId: null, joinedAt: stamp };
const member = { userId: "user-2", email: null, displayName: "Member", role: "member", status: "active", clientId: null, joinedAt: stamp };
const project = { name: "Site", key: "SITE", description: null, clientId: null, status: "active", enabledTools: ["todos"], defaultVisibility: "internal", templateSource: null, createdBy: "admin-1", createdAt: stamp, updatedBy: "admin-1", updatedAt: stamp };
const organization = { kind: "team", name: "Studio", slug: "studio", timezone: "UTC", ownerId: "admin-1", onboardingState: "complete", createdAt: stamp, updatedAt: stamp };

function environment(extra: Record<string, Record<string, unknown>> = {}) {
  const records: Record<string, Record<string, unknown>> = { "organizations/o1": organization, "organizations/o1/members/admin-1": admin, "organizations/o1/members/user-2": member, "organizations/o1/projects/p1": project, ...extra };
  const writes: Array<{ method: string; path: string; data: unknown }> = [];
  const ref = (path: string) => ({ path, id: path.split("/").at(-1) });
  const collection = (path: string) => { const query = { path, filters: [] as Array<[string, unknown]>, where(field: string, _operator: string, value: unknown) { this.filters.push([field, value]); return this; }, doc: () => ref(`${path}/generated`) }; return query; };
  const snapshotFor = (reference: { path: string; filters?: Array<[string, unknown]> }) => {
    if (reference.filters) { const docs = Object.entries(records).filter(([path, data]) => path.startsWith(`${reference.path}/`) && path.split("/").length === reference.path.split("/").length + 1 && reference.filters!.every(([field, value]) => data[field] === value)).map(([path, data]) => ({ id: path.split("/").at(-1), data: () => data })); return { docs, size: docs.length, empty: docs.length === 0 }; }
    const data = records[reference.path]; return { exists: Boolean(data), id: reference.path.split("/").at(-1), data: () => data };
  };
  const transaction = { get: vi.fn(async (reference) => snapshotFor(reference)), update: vi.fn((reference, data) => writes.push({ method: "update", path: reference.path, data })), set: vi.fn((reference, data) => writes.push({ method: "set", path: reference.path, data })) };
  const collectionGroup = vi.fn(() => {
    const filters: Array<[string, unknown]> = [];
    const query = {
      where(field: string, _operator: string, value: unknown) { filters.push([field, value]); return query; },
      async get() {
        const docs = Object.entries(records)
          .filter(([path, data]) => path.includes("/projectMembers/") && filters.every(([field, value]) => data[field] === value))
          .map(([path, data]) => {
            const parts = path.split("/");
            const organizationId = parts[1];
            const projectId = parts[3];
            return { data: () => data, ref: { parent: { parent: { id: projectId, parent: { parent: { id: organizationId } } } } } };
          });
        return { docs };
      },
    };
    return query;
  });
  const db = { doc: vi.fn(ref), collection: vi.fn(collection), collectionGroup, runTransaction: vi.fn(async (callback: (transaction: Transaction) => Promise<unknown>) => callback(transaction as unknown as Transaction)) } as unknown as Firestore;
  const auditRepository: AuditWriter = { append: vi.fn(async () => ({ id: "audit-failure" })), appendInTransaction: vi.fn(() => ({ id: "audit-success" })) };
  return { db, auditRepository, writes };
}

describe("admin service", () => {
  it("prevents demoting the final active administrator", async () => {
    const env = environment();
    await expect(changeMemberRole(actor, "o1", { userId: "admin-1", role: "member" }, correlation, env)).rejects.toThrow("final active admin");
    expect(env.writes).toHaveLength(0);
  });

  it("prevents assigning a client to a project owned by another client", async () => {
    const client = { userId: "client-1", email: null, displayName: "Client", role: "client", status: "active", clientId: "client-a", joinedAt: stamp };
    const env = environment({ "organizations/o1/members/client-1": client, "organizations/o1/projects/p1": { ...project, clientId: "client-b" } });
    await expect(changeProjectAssignment(actor, "o1", { userId: "client-1", projectId: "p1", action: "assign" }, correlation, env)).rejects.toThrow("mismatch");
    expect(env.writes).toHaveLength(0);
  });

  it("assigns an active member and preserves historical records", async () => {
    const env = environment();
    await changeProjectAssignment(actor, "o1", { userId: "user-2", projectId: "p1", action: "assign" }, correlation, env);
    expect(env.writes).toMatchObject([{ method: "set", path: "organizations/o1/projects/p1/projectMembers/user-2", data: { userId: "user-2", projectRole: "member", status: "active", assignedBy: "admin-1", removedAt: null } }]);
  });

  it("assigns project-administrator authority when requested", async () => {
    const env = environment();
    await changeProjectAssignment(actor, "o1", { userId: "user-2", projectId: "p1", action: "assign", projectRole: "admin" }, correlation, env);
    expect(env.writes).toMatchObject([{ method: "set", path: "organizations/o1/projects/p1/projectMembers/user-2", data: { projectRole: "admin", status: "active" } }]);
  });

  it("converts an organization administrator to a scoped project administrator", async () => {
    const targetAdmin = { ...admin, userId: "user-2", displayName: "Second admin" };
    const env = environment({
      "organizations/o1/members/user-2": targetAdmin,
      "organizations/o1/members/admin-2": { ...admin, userId: "admin-2" },
      "organizations/o1/projects/p1/projectMembers/user-2": { userId: "user-2", projectRole: "member", status: "active", assignedBy: "admin-1", assignedAt: stamp, removedAt: null },
    });
    await changeMemberRole(actor, "o1", { userId: "user-2", role: "project_admin", projectIds: ["p1"] }, correlation, env);
    expect(env.writes).toContainEqual({ method: "update", path: "organizations/o1/members/user-2", data: { role: "member" } });
    expect(env.writes).toContainEqual(expect.objectContaining({ method: "set", path: "organizations/o1/projects/p1/projectMembers/user-2", data: expect.objectContaining({ projectRole: "admin", status: "active" }) }));
  });

  it("downgrades every discovered project-admin assignment without trusting browser project IDs", async () => {
    const env = environment({
      "organizations/o1/projects/p1/projectMembers/user-2": { userId: "user-2", projectRole: "admin", status: "active", assignedBy: "admin-1", assignedAt: stamp, removedAt: null },
    });
    await changeMemberRole(actor, "o1", { userId: "user-2", role: "member", projectIds: [] }, correlation, env);
    expect(env.writes).toContainEqual(expect.objectContaining({ method: "set", path: "organizations/o1/projects/p1/projectMembers/user-2", data: expect.objectContaining({ projectRole: "member" }) }));
  });

  it("updates organization name and timezone without rewriting domain timestamps", async () => {
    const env = environment();
    const result = await updateOrganizationSettings(actor, "o1", { name: "New Studio", timezone: "America/Los_Angeles" }, correlation, env);
    expect(result).toEqual({ nameChanged: true, timezoneChanged: true });
    expect(env.writes[0]).toMatchObject({ method: "update", path: "organizations/o1", data: { name: "New Studio", timezone: "America/Los_Angeles" } });
  });
});
