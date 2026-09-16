import { describe, expect, it, vi } from "vitest";
import type { DecodedIdToken } from "firebase-admin/auth";

vi.mock("server-only", () => ({}));

import {
  AuthenticationError,
  verifyFirebaseIdToken,
  verifyFirebaseSessionCookie,
} from "@/lib/auth-server";

function decodedToken(overrides: Partial<DecodedIdToken> = {}): DecodedIdToken {
  return {
    aud: "time-log",
    auth_time: 1,
    exp: 2,
    firebase: { identities: {}, sign_in_provider: "google.com" },
    iat: 1,
    iss: "https://securetoken.google.com/time-log",
    sub: "user-123",
    uid: "user-123",
    ...overrides,
  };
}

function verifier(token = decodedToken()) {
  return {
    verifyIdToken: vi.fn().mockResolvedValue(token),
    verifySessionCookie: vi.fn().mockResolvedValue(token),
  };
}

describe("Firebase server authentication", () => {
  it("returns a minimal actor from a verified ID token", async () => {
    const tokenVerifier = verifier(decodedToken({
      email: "person@example.com",
      email_verified: true,
      name: "Person",
    }));

    await expect(
      verifyFirebaseIdToken("id-token", { verifier: tokenVerifier }),
    ).resolves.toEqual({
      type: "user",
      uid: "user-123",
      email: "person@example.com",
      emailVerified: true,
      displayName: "Person",
    });
    expect(tokenVerifier.verifyIdToken).toHaveBeenCalledWith("id-token", false);
  });

  it("checks session-cookie revocation by default", async () => {
    const tokenVerifier = verifier();

    await verifyFirebaseSessionCookie("session-cookie", { verifier: tokenVerifier });

    expect(tokenVerifier.verifySessionCookie).toHaveBeenCalledWith("session-cookie", true);
  });

  it("maps rejected credentials to a stable authentication error", async () => {
    const tokenVerifier = verifier();
    tokenVerifier.verifyIdToken.mockRejectedValue(new Error("SDK detail"));

    await expect(
      verifyFirebaseIdToken("invalid", { verifier: tokenVerifier }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
