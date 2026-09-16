import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createRequestCorrelation, createRunCorrelation } from "@/domain/audit/correlation";

describe("audit correlation", () => {
  it("generates server request IDs and no interactive run ID", () => {
    const first = createRequestCorrelation();
    const second = createRequestCorrelation();

    expect(first.requestId).not.toBe(second.requestId);
    expect(first.runId).toBeNull();
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("generates a stable run identifier for background workflows", () => {
    const correlation = createRunCorrelation();
    const nextLifecycleRequest = createRequestCorrelation(correlation.runId);

    expect(nextLifecycleRequest.requestId).not.toBe(correlation.requestId);
    expect(nextLifecycleRequest.runId).toBe(correlation.runId);
  });

  it("rejects malformed propagated run IDs", () => {
    expect(() => createRequestCorrelation("browser-controlled")).toThrow();
  });
});
