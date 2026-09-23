import { describe, expect, it } from "vitest";
import { inactivityResponseSeconds, shouldWarnForVisiblePage } from "@/domain/time/inactivity";

describe("timer inactivity policy", () => {
  it("warns only after two visible minutes without activity", () => {
    const base = { visible: true, lastActivityAt: 1_000, suppressedUntil: 0, warningOpen: false };
    expect(shouldWarnForVisiblePage({ ...base, now: 120_999 })).toBe(false);
    expect(shouldWarnForVisiblePage({ ...base, now: 121_000 })).toBe(true);
    expect(shouldWarnForVisiblePage({ ...base, now: 121_000, visible: false })).toBe(false);
    expect(shouldWarnForVisiblePage({ ...base, now: 121_000, warningOpen: true })).toBe(false);
    expect(shouldWarnForVisiblePage({ ...base, now: 121_000, suppressedUntil: 122_000 })).toBe(false);
  });

  it("rounds the response countdown up and never below zero", () => {
    expect(inactivityResponseSeconds(30_000, 0)).toBe(30);
    expect(inactivityResponseSeconds(30_000, 29_001)).toBe(1);
    expect(inactivityResponseSeconds(30_000, 31_000)).toBe(0);
  });
});
