import { describe, expect, it } from "vitest";

import { isHabitDue } from "@/lib/habit-schedule";

describe("habit schedule", () => {
  it("treats a missing schedule as due", () => {
    expect(isHabitDue(undefined, new Date(2026, 8, 14))).toBe(true);
  });

  it("uses Monday as the first schedule position", () => {
    const monday = new Date(2026, 8, 14);
    const sunday = new Date(2026, 8, 20);

    expect(isHabitDue("M------", monday)).toBe(true);
    expect(isHabitDue("M------", sunday)).toBe(false);
  });

  it("falls back to due for a malformed legacy schedule", () => {
    expect(isHabitDue("MWF", new Date(2026, 8, 14))).toBe(true);
  });
});
