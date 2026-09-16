import { describe, expect, it } from "vitest";
import { parseApplicationUrl, parseResendEnvironment } from "@/lib/resend-config";

describe("Resend configuration", () => {
  it("parses server email configuration and normalizes the app URL", () => {
    expect(parseResendEnvironment({ RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "Time Log <hello@example.com>", NEXT_PUBLIC_APP_URL: "https://time.example.com/" })).toEqual({ apiKey: "re_test", fromEmail: "Time Log <hello@example.com>", appUrl: "https://time.example.com" });
  });
  it("fails closed when configuration is incomplete", () => {
    expect(() => parseResendEnvironment({})).toThrow("Email delivery is not configured");
  });
  it("uses localhost only outside production when the public URL is absent", () => {
    expect(parseApplicationUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(() => parseApplicationUrl({ NODE_ENV: "production" })).toThrow("Application URL is not configured");
  });
});
