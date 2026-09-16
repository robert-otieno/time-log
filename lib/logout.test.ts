import { describe, expect, it, vi } from "vitest";

import { completeLogout } from "@/lib/logout";

describe("completeLogout", () => {
  it("clears the legacy token after sign-out succeeds", async () => {
    const calls: string[] = [];

    await completeLogout({
      clearServerSession: async () => {
        calls.push("clear-session");
      },
      signOutUser: async () => {
        calls.push("sign-out");
      },
      clearLegacyToken: () => {
        calls.push("clear-token");
      },
    });

    expect(calls).toEqual(["clear-session", "sign-out", "clear-token"]);
  });

  it("does not clear the token when sign-out fails", async () => {
    const error = new Error("provider failure");
    const clearLegacyToken = vi.fn();

    await expect(
      completeLogout({
        clearServerSession: async () => {},
        signOutUser: async () => {
          throw error;
        },
        clearLegacyToken,
      }),
    ).rejects.toBe(error);

    expect(clearLegacyToken).not.toHaveBeenCalled();
  });

  it("does not sign out the browser when the server session cannot be cleared", async () => {
    const signOutUser = vi.fn();
    const clearLegacyToken = vi.fn();

    await expect(
      completeLogout({
        clearServerSession: async () => {
          throw new Error("server unavailable");
        },
        signOutUser,
        clearLegacyToken,
      }),
    ).rejects.toThrow("server unavailable");

    expect(signOutUser).not.toHaveBeenCalled();
    expect(clearLegacyToken).not.toHaveBeenCalled();
  });
});
