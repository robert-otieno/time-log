import { describe, expect, it } from "vitest";

import { DELETE } from "@/app/api/auth/logout/route";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";

function logoutRequest(origin = "https://app.example") {
  return new Request("https://app.example/api/auth/logout", {
    method: "DELETE",
    headers: {
      origin,
      "content-type": "application/json",
    },
    body: "{}",
  });
}

describe("DELETE /api/auth/logout", () => {
  it("expires both authentication cookies without exposing their values", async () => {
    const response = await DELETE(logoutRequest());
    const cookies = response.headers.getSetCookie();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${SESSION_COOKIE_NAME}=;`),
        expect.stringContaining("token=;"),
      ]),
    );
    expect(cookies.every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("is idempotent", async () => {
    const first = await DELETE(logoutRequest());
    const second = await DELETE(logoutRequest());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it("rejects cross-origin requests", async () => {
    const response = await DELETE(logoutRequest("https://evil.example"));

    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});
