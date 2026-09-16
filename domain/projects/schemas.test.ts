import { describe, expect, it } from "vitest";
import { createProjectCommandSchema, updateProjectCommandSchema } from "@/domain/projects/schemas";
import { projectToolFromPath } from "@/domain/projects/tools";

describe("project commands", () => {
  it("deduplicates enabled tools and preserves safe project fields", () => {
    expect(createProjectCommandSchema.parse({ name: " Launch ", description: null, clientId: null, enabledTools: ["todos", "time", "todos"] })).toEqual({ name: "Launch", description: null, clientId: null, enabledTools: ["todos", "time"] });
  });
  it("rejects projects without an enabled tool and unknown fields", () => {
    expect(createProjectCommandSchema.safeParse({ name: "Launch", description: null, clientId: null, enabledTools: [] }).success).toBe(false);
    expect(updateProjectCommandSchema.safeParse({ projectId: "p1", name: "Launch", description: null, clientId: null, enabledTools: ["todos"], key: "OVERRIDE" }).success).toBe(false);
  });
  it("maps only canonical enabled-tool route segments", () => {
    expect(projectToolFromPath("check-ins")).toBe("check-ins");
    expect(projectToolFromPath("settings")).toBeNull();
    expect(projectToolFromPath("internal-secret")).toBeNull();
  });
});
