import { describe, expect, it } from "vitest";
import { priorityTone, statusTone } from "@/components/ui/status-badge";

describe("semantic badge tones", () => {
  it.each([
    ["done", "success"],
    ["in_progress", "warning"],
    ["blocked", "blocked"],
    ["todo", "info"],
    ["backlog", "neutral"],
    ["archived", "neutral"],
  ] as const)("maps %s status to %s", (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });

  it.each([
    ["urgent", "blocked"],
    ["high", "warning"],
    ["medium", "info"],
    ["low", "neutral"],
  ] as const)("maps %s priority to %s", (priority, tone) => {
    expect(priorityTone(priority)).toBe(tone);
  });
});
