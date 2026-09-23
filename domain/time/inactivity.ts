export const INACTIVITY_THRESHOLD_MS = 2 * 60 * 1000;
export const INACTIVITY_RESPONSE_MS = 30 * 1000;

export function inactivityResponseSeconds(deadline: number, now: number) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function shouldWarnForVisiblePage(input: {
  visible: boolean;
  now: number;
  lastActivityAt: number;
  suppressedUntil: number;
  warningOpen: boolean;
}) {
  return input.visible && !input.warningOpen && input.now >= input.suppressedUntil && input.now - input.lastActivityAt >= INACTIVITY_THRESHOLD_MS;
}
