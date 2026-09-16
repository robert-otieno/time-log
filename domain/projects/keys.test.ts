import { describe, expect, it } from "vitest";
import { projectKeyBase, projectKeyCandidate } from "@/domain/projects/keys";

describe("project keys", () => {
  it("creates valid uppercase keys", () => {
    expect(projectKeyBase("Website redesign")).toBe("WR");
    expect(projectKeyBase("Alpha")).toBe("ALPHA");
    expect(projectKeyBase("1")).toBe("PR");
  });
  it("adds bounded collision suffixes", () => {
    expect(projectKeyCandidate("LONGPROJEC", 1)).toBe("LONGPROJE2");
    expect(projectKeyCandidate("WR", 8)).toBe("WR9");
  });
});
