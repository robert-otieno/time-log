import { describe, expect, it } from "vitest";
import { formatElapsedTimer } from "@/domain/time/display";

describe("timer display", () => {
  it("derives hours, minutes, and seconds from the server start instant", () => {
    expect(formatElapsedTimer("2026-09-20T08:00:00.000Z", Date.parse("2026-09-20T09:02:03.900Z"))).toBe("01:02:03");
  });

  it("does not display negative elapsed time during clock skew", () => {
    expect(formatElapsedTimer("2026-09-20T08:00:01.000Z", Date.parse("2026-09-20T08:00:00.000Z"))).toBe("00:00:00");
  });
});
