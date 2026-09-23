import { describe, expect, it } from "vitest";
import { OptimisticMutationRegistry } from "@/lib/optimistic-mutation";

describe("optimistic mutation registry", () => {
  it("isolates unrelated records and rejects overlap on the same record", () => {
    const registry = new OptimisticMutationRegistry();
    const first = registry.begin("task:1", "complete");
    const second = registry.begin("task:2", "complete");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(registry.begin("task:1", "edit")).toBeNull();
    expect(registry.isPending("task:1")).toBe(true);
  });

  it("does not allow an obsolete token to finish a newer operation", () => {
    const registry = new OptimisticMutationRegistry();
    const first = registry.begin("task:1", "complete")!;
    registry.finish(first);
    const second = registry.begin("task:1", "edit")!;
    registry.finish(first);
    expect(registry.isCurrent(second)).toBe(true);
    registry.finish(second);
    expect(registry.isPending("task:1")).toBe(false);
  });
});
