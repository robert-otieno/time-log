import { describe, expect, it } from "vitest";
import { toProjectFormClient, toProjectFormProject } from "@/domain/projects/form-data";
import type { Client, Project } from "@/domain/organizations/schemas";

const timestamp = { seconds: 1, nanoseconds: 2 };

describe("project form DTOs", () => {
  it("remove Firestore-backed metadata from client component props", () => {
    const project = { id: "p1", name: "Site", key: "SS", description: null, clientId: null, status: "active", enabledTools: ["todos", "time"], defaultVisibility: "internal", templateSource: null, createdBy: "u1", createdAt: timestamp, updatedBy: "u1", updatedAt: timestamp } as Project;
    const client = { id: "c1", name: "Acme", status: "active", createdBy: "u1", createdAt: timestamp, updatedBy: "u1", updatedAt: timestamp } as Client;
    expect(toProjectFormProject(project)).toEqual({ id: "p1", name: "Site", description: null, clientId: null, enabledTools: ["todos", "time"] });
    expect(toProjectFormClient(client)).toEqual({ id: "c1", name: "Acme" });
    expect(JSON.stringify({ project: toProjectFormProject(project), client: toProjectFormClient(client) })).not.toContain("createdAt");
  });
});
