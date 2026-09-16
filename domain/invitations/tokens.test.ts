import { describe, expect, it } from "vitest";
import { createInvitationToken, hashInvitationToken, normalizeInvitationEmail } from "@/domain/invitations/tokens";

describe("invitation tokens", () => {
  it("normalizes invitation email addresses", () => {
    expect(normalizeInvitationEmail(" Person@Example.COM ")).toBe("person@example.com");
  });

  it("creates opaque tokens and stable non-reversible hashes", () => {
    const first = createInvitationToken();
    const second = createInvitationToken();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(hashInvitationToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashInvitationToken(first)).toBe(hashInvitationToken(first));
    expect(hashInvitationToken(first)).not.toContain(first);
  });
});
