import { describe, expect, it } from "vitest";

import {
  isRecentSignIn,
  isSameOriginJsonRequest,
  safeReturnPath,
} from "@/lib/auth-session";

describe("safeReturnPath", () => {
  it.each([
    ["/", "/"],
    ["/projects/one?tab=tasks", "/projects/one?tab=tasks"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["/login", "/"],
    [null, "/"],
  ])("maps %s to %s", (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });
});

describe("isRecentSignIn", () => {
  it("accepts authentication within five minutes", () => {
    expect(isRecentSignIn(900, 1_000)).toBe(true);
  });

  it("rejects stale and future authentication times", () => {
    expect(isRecentSignIn(699, 1_000)).toBe(false);
    expect(isRecentSignIn(1_001, 1_000)).toBe(false);
  });
});

describe("isSameOriginJsonRequest", () => {
  it("accepts a same-origin JSON request", () => {
    const request = new Request("https://app.example/api/auth/session", {
      method: "POST",
      headers: { origin: "https://app.example", "content-type": "application/json" },
    });
    expect(isSameOriginJsonRequest(request)).toBe(true);
  });

  it("rejects cross-origin and form requests", () => {
    const crossOrigin = new Request("https://app.example/api/auth/session", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
    });
    const form = new Request("https://app.example/api/auth/session", {
      method: "POST",
      headers: { origin: "https://app.example", "content-type": "text/plain" },
    });
    expect(isSameOriginJsonRequest(crossOrigin)).toBe(false);
    expect(isSameOriginJsonRequest(form)).toBe(false);
  });
});
